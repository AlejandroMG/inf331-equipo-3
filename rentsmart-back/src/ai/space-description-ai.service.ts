import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider, AiProviderError } from './ai-provider';
import {
  type SpaceDescriptionInput,
  type SpaceDescriptionResult,
} from './ai-provider';
import { AiUsageQuotaService } from './ai-usage-quota.service';

@Injectable()
export class SpaceDescriptionAiService {
  private readonly logger = new Logger(SpaceDescriptionAiService.name);
  private readonly timeoutMs: number;

  constructor(
    private readonly quota: AiUsageQuotaService,
    private readonly provider: AiProvider,
    config: ConfigService,
  ) {
    this.timeoutMs = config.get<number>('AI_TIMEOUT_MS') ?? 15_000;
  }

  async generate(
    userId: string,
    spaceId: string,
    input: SpaceDescriptionInput,
  ): Promise<SpaceDescriptionResult> {
    if (!userId.trim()) {
      throw new UnauthorizedException();
    }

    const reservation = await this.quota.reserve(userId, spaceId);

    let description: string;
    try {
      description = await this.withTimeout(input);
    } catch (error: unknown) {
      const reason =
        error instanceof AiProviderError
          ? error.message
          : error instanceof Error
            ? error.name
            : 'UnknownError';
      this.logger.warn(
        `Proveedor de IA no disponible (${reason}); se devuelve una descripción de respaldo`,
      );
      const description = this.buildFallback(input);
      await this.quota.saveFallback(reservation.attemptId, description);
      return {
        description,
        source: 'fallback',
        attemptsUsed: reservation.attemptsUsed,
      };
    }

    await this.quota.markSucceeded(
      reservation.attemptId,
      description,
      this.provider.source,
    );
    return {
      description,
      source: this.provider.source,
      attemptsUsed: reservation.attemptsUsed,
    };
  }

  private async withTimeout(input: SpaceDescriptionInput): Promise<string> {
    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        controller.abort();
        reject(new AiProviderError('El proveedor excedió el tiempo de espera'));
      }, this.timeoutMs);
    });

    try {
      return await Promise.race([
        this.provider.generateSpaceDescription(input, controller.signal),
        timeout,
      ]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  private buildFallback(input: SpaceDescriptionInput): string {
    const location = [input.address, input.commune, input.region]
      .filter(Boolean)
      .join(', ');
    const opening = `Se arrienda ${input.type ?? 'el espacio'} "${input.name}"${location ? ` en ${location}` : ''}${input.capacity !== undefined ? `, con capacidad para ${input.capacity} personas` : ''}.`;
    const details = [
      input.amenities?.length &&
        `Cuenta con ${joinNaturally(input.amenities)}.`,
      input.rules && `Entre las reglas del espacio se indica: ${input.rules}.`,
      (input.pricePerHour !== undefined ||
        input.pricePerDay !== undefined) &&
        `El valor es ${[
          input.pricePerHour !== undefined &&
            `$${input.pricePerHour.toLocaleString('es-CL')} por hora`,
          input.pricePerDay !== undefined &&
            `$${input.pricePerDay.toLocaleString('es-CL')} por día`,
        ]
          .filter(Boolean)
          .join(' y ')}.`,
      input.schedule?.length &&
        `Está disponible ${joinNaturally(
          input.schedule.map(
            ({ weekday, startTime, endTime }) =>
              `los ${WEEKDAYS[weekday]} de ${startTime} a ${endTime}`,
          ),
        )}.`,
    ].filter((detail): detail is string => Boolean(detail));
    return [opening, ...details].join(' ');
  }
}

function joinNaturally(values: string[]): string {
  if (values.length < 2) return values[0] ?? '';
  return `${values.slice(0, -1).join(', ')} y ${values[values.length - 1]}`;
}

const WEEKDAYS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const;
