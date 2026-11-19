import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export const DEFAULT_AI_MAX_USES_PER_24H = 15;
export const MAX_AI_GENERATIONS_PER_SPACE = 5;
const DEFAULT_AI_TIMEOUT_MS = 15_000;
const USAGE_WINDOW_MS = 24 * 60 * 60 * 1000;
const LEASE_GRACE_MS = 30_000;

export type AiGenerationReservation = {
  attemptId: string;
  attemptsUsed: number;
};

@Injectable()
export class AiUsageQuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async reserve(
    userId: string,
    spaceId: string,
  ): Promise<AiGenerationReservation> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - USAGE_WINDOW_MS);
    const timeoutMs =
      this.config.get<number>('AI_TIMEOUT_MS') ?? DEFAULT_AI_TIMEOUT_MS;
    const leaseExpiresAt = new Date(now.getTime() + timeoutMs + LEASE_GRACE_MS);
    const limit =
      this.config.get<number>('AI_MAX_USES_PER_24H') ??
      DEFAULT_AI_MAX_USES_PER_24H;
    const attemptId = randomUUID();

    return this.prisma.$transaction(async (tx) => {
      // Serializa los límites del usuario y del espacio.
      const users = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE
      `;
      if (users.length === 0)
        throw new NotFoundException('No existe el usuario.');

      const spaces = await tx.$queryRaw<
        Array<{ ownerId: string; status: string }>
      >`
        SELECT "ownerId", "status" FROM "Space" WHERE "id" = ${spaceId} FOR UPDATE
      `;
      if (spaces.length === 0)
        throw new NotFoundException('No existe el espacio.');
      if (spaces[0].ownerId !== userId) {
        throw new ForbiddenException(
          'Solo el propietario puede generar la descripción del espacio.',
        );
      }
      if (spaces[0].status !== 'DRAFT') {
        throw new ConflictException(
          'Solo puedes generar una descripción para un borrador.',
        );
      }

      const existing = await tx.aiSpaceGeneration.findUnique({
        where: { spaceId },
      });
      if (existing && existing.attemptCount >= MAX_AI_GENERATIONS_PER_SPACE) {
        throw new HttpException(
          `Alcanzaste el límite de ${MAX_AI_GENERATIONS_PER_SPACE} generaciones para esta publicación.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (
        existing &&
        existing.completedAt === null &&
        existing.leaseExpiresAt > now
      ) {
        throw new ConflictException(
          'Ya hay una generación en curso para este espacio.',
        );
      }

      await tx.aiGeneration.deleteMany({
        where: { userId, createdAt: { lt: windowStart } },
      });
      const used = await tx.aiGeneration.count({
        where: { userId, createdAt: { gte: windowStart } },
      });
      if (used >= limit) {
        throw new HttpException(
          `Alcanzaste el límite de ${limit} intentos de IA cada 24 horas.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      await tx.aiGeneration.create({
        data: { id: attemptId, userId, spaceId },
      });

      if (existing) {
        await tx.aiSpaceGeneration.update({
          where: { spaceId },
          data: {
            userId,
            attemptId,
            createdAt: now,
            leaseExpiresAt,
            reviewedAt: null,
            completedAt: null,
            attemptCount: { increment: 1 },
          },
        });
      } else {
        await tx.aiSpaceGeneration.create({
          data: {
            userId,
            spaceId,
            attemptId,
            leaseExpiresAt,
            attemptCount: 1,
          },
        });
      }

      return {
        attemptId,
        attemptsUsed: (existing?.attemptCount ?? 0) + 1,
      };
    });
  }

  async markSucceeded(
    attemptId: string,
    description: string,
    source: string,
  ): Promise<void> {
    const result = await this.prisma.aiSpaceGeneration.updateMany({
      where: {
        attemptId,
        completedAt: null,
        leaseExpiresAt: { gt: new Date() },
      },
      data: { completedAt: new Date(), description, source, reviewedAt: null },
    });
    if (result.count !== 1) {
      throw new ConflictException(
        'La reserva de generación venció; puedes solicitarla nuevamente.',
      );
    }
  }

  async saveFallback(attemptId: string, description: string): Promise<void> {
    const result = await this.prisma.aiSpaceGeneration.updateMany({
      where: { attemptId, completedAt: null },
      data: {
        description,
        source: 'fallback',
        reviewedAt: null,
        leaseExpiresAt: new Date(),
      },
    });
    if (result.count !== 1) {
      throw new ConflictException(
        'La reserva de generación venció; puedes solicitarla nuevamente.',
      );
    }
  }
}
