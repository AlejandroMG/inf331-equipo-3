import {
  ConflictException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AiUsageQuotaService } from './ai-usage-quota.service';

describe('AiUsageQuotaService', () => {
  const transaction = {
    $queryRaw: jest.fn(),
    aiGeneration: {
      deleteMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    aiSpaceGeneration: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(),
    aiSpaceGeneration: { updateMany: jest.fn() },
  };
  const config = {
    get: jest.fn((key: string) =>
      key === 'AI_MAX_USES_PER_24H' ? 15 : 15_000,
    ),
  };
  let service: AiUsageQuotaService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (run: (tx: typeof transaction) => Promise<void>) => run(transaction),
    );
    transaction.$queryRaw
      .mockResolvedValueOnce([{ id: 'user-1' }])
      .mockResolvedValueOnce([{ ownerId: 'user-1', status: 'DRAFT' }]);
    transaction.aiGeneration.deleteMany.mockResolvedValue({ count: 0 });
    transaction.aiGeneration.count.mockResolvedValue(14);
    transaction.aiGeneration.create.mockResolvedValue({ id: 'attempt-id' });
    transaction.aiSpaceGeneration.findUnique.mockResolvedValue(null);
    transaction.aiSpaceGeneration.create.mockResolvedValue({});
    transaction.aiSpaceGeneration.update.mockResolvedValue({});
    prisma.aiSpaceGeneration.updateMany.mockResolvedValue({ count: 1 });
    service = new AiUsageQuotaService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
    );
  });

  it('reserva un intento para el propietario y aplica la ventana móvil de 24 horas', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-16T12:00:00.000Z'));

    const reservation = await service.reserve('user-1', 'space-1');
    const { attemptId } = reservation;
    expect(attemptId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(2);
    expect(transaction.aiGeneration.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        createdAt: { lt: new Date('2026-11-15T12:00:00.000Z') },
      },
    });
    expect(transaction.aiGeneration.count).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        createdAt: { gte: new Date('2026-11-15T12:00:00.000Z') },
      },
    });
    expect(transaction.aiGeneration.create).toHaveBeenCalledWith({
      data: { id: attemptId, userId: 'user-1', spaceId: 'space-1' },
    });
    expect(transaction.aiSpaceGeneration.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        spaceId: 'space-1',
        attemptId,
        leaseExpiresAt: new Date('2026-11-16T12:00:45.000Z'),
        attemptCount: 1,
      },
    });
    expect(reservation.attemptsUsed).toBe(1);

    jest.useRealTimers();
  });

  it('rechaza el decimosexto intento diario y no lo registra', async () => {
    transaction.aiGeneration.count.mockResolvedValue(15);

    await expect(service.reserve('user-1', 'space-1')).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });

    expect(transaction.aiGeneration.create).not.toHaveBeenCalled();
  });

  it('rechaza generar para un espacio ajeno y no consume cuota', async () => {
    transaction.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([{ id: 'user-1' }])
      .mockResolvedValueOnce([{ ownerId: 'another-user', status: 'DRAFT' }]);

    await expect(service.reserve('user-1', 'space-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(transaction.aiGeneration.create).not.toHaveBeenCalled();
  });

  it('rechaza usuario o espacio inexistente', async () => {
    transaction.$queryRaw.mockReset().mockResolvedValueOnce([]);

    await expect(
      service.reserve('missing-user', 'space-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('permite otra generación para el mismo espacio si el lease anterior venció', async () => {
    transaction.aiSpaceGeneration.findUnique.mockResolvedValue({
      attemptCount: 1,
      completedAt: null,
      leaseExpiresAt: new Date('2026-11-15T00:00:00.000Z'),
    });

    const reservation = await service.reserve('user-1', 'space-1');

    expect(transaction.aiSpaceGeneration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { spaceId: 'space-1' },
        data: expect.objectContaining({
          attemptId: expect.any(String),
          reviewedAt: null,
          completedAt: null,
          attemptCount: { increment: 1 },
        }),
      }),
    );
    expect(reservation.attemptsUsed).toBe(2);
    expect(transaction.aiSpaceGeneration.create).not.toHaveBeenCalled();
  });

  it('permite generar de nuevo tras un éxito y contabiliza el intento', async () => {
    transaction.aiSpaceGeneration.findUnique.mockResolvedValue({
      attemptCount: 1,
      completedAt: new Date('2026-11-16T11:00:00.000Z'),
      leaseExpiresAt: new Date('2026-11-16T11:30:00.000Z'),
    });

    const reservation = await service.reserve('user-1', 'space-1');
    expect(reservation.attemptsUsed).toBe(2);
    expect(transaction.aiSpaceGeneration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attemptCount: { increment: 1 },
          completedAt: null,
        }),
      }),
    );
  });

  it('rechaza la sexta generación por publicación sin consumir cuota diaria', async () => {
    transaction.aiSpaceGeneration.findUnique.mockResolvedValue({
      attemptCount: 5,
      completedAt: new Date('2026-11-16T11:00:00.000Z'),
      leaseExpiresAt: new Date('2026-11-16T11:30:00.000Z'),
    });

    await expect(service.reserve('user-1', 'space-1')).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
      message: expect.stringContaining('5 generaciones'),
    });
    expect(transaction.aiGeneration.create).not.toHaveBeenCalled();
    expect(transaction.aiGeneration.count).not.toHaveBeenCalled();
  });

  it('impide intentos duplicados mientras otro está en curso', async () => {
    transaction.aiSpaceGeneration.findUnique.mockResolvedValue({
      attemptCount: 0,
      completedAt: null,
      leaseExpiresAt: new Date(Date.now() + 60_000),
    });

    await expect(service.reserve('user-1', 'space-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(transaction.aiGeneration.create).not.toHaveBeenCalled();
  });

  it('marca el uso como exitoso y persiste una sugerencia de respaldo reintentable', async () => {
    await service.markSucceeded('attempt-id', 'Descripción', 'gemini');
    await service.saveFallback('attempt-id', 'Texto de respaldo');

    expect(prisma.aiSpaceGeneration.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          attemptId: 'attempt-id',
          completedAt: null,
        }),
        data: {
          completedAt: expect.any(Date),
          description: 'Descripción',
          source: 'gemini',
          reviewedAt: null,
        },
      }),
    );
    expect(prisma.aiSpaceGeneration.updateMany).toHaveBeenLastCalledWith({
      where: { attemptId: 'attempt-id', completedAt: null },
      data: {
        description: 'Texto de respaldo',
        source: 'fallback',
        reviewedAt: null,
        leaseExpiresAt: expect.any(Date),
      },
    });
  });
});
