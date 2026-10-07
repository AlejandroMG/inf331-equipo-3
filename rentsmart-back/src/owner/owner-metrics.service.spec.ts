import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { OwnerMetricsService } from './owner-metrics.service';

describe('OwnerMetricsService', () => {
  let service: OwnerMetricsService;
  const prisma = {
    space: { findMany: jest.fn() },
    booking: { findMany: jest.fn() },
  };
  const monday = (start = '09:00', end = '21:00') => ({
    weekday: 1,
    startTime: start,
    endTime: end,
  });
  const booking = (spaceId: string, hours: number, subtotal: number) => ({
    spaceId,
    startAt: new Date('2026-10-05T16:00:00Z'),
    endAt: new Date(Date.parse('2026-10-05T16:00:00Z') + hours * 3_600_000),
    subtotal,
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        OwnerMetricsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(OwnerMetricsService);
  });

  it('pide solo reservas confirmadas o finalizadas que empiezan en el mes de Chile, y sin borradores', async () => {
    prisma.space.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);

    await service.metrics('u1', '2026-10');

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          space: { ownerId: 'u1' },
          status: { in: ['CONFIRMED', 'FINISHED'] },
          startAt: {
            gte: new Date('2026-10-01T03:00:00Z'),
            lt: new Date('2026-11-01T03:00:00Z'),
          },
        },
      }),
    );
    expect(prisma.space.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: 'u1', status: { not: 'DRAFT' } },
      }),
    );
  });

  it('las horas arrendables suman el horario de cada día de la semana por las veces que cae en el mes', async () => {
    prisma.space.findMany.mockResolvedValue([
      { id: 's1', name: 'Sala', status: 'ACTIVE', rulesWeek: [monday()] },
    ]);
    prisma.booking.findMany.mockResolvedValue([]);

    const { spaces } = await service.metrics('u1', '2026-10');

    // Octubre de 2026 tiene 4 lunes.
    expect(spaces[0]).toMatchObject({ availableHours: 48, occupancy: 0 });
  });

  it('varios tramos el mismo día se suman', async () => {
    prisma.space.findMany.mockResolvedValue([
      {
        id: 's1',
        name: 'Sala',
        status: 'ACTIVE',
        rulesWeek: [monday('09:00', '13:00'), monday('15:00', '19:00')],
      },
    ]);
    prisma.booking.findMany.mockResolvedValue([]);

    const { spaces } = await service.metrics('u1', '2026-10');

    expect(spaces[0].availableHours).toBe(32);
  });

  it('la ocupación no pasa de 1 aunque las reservas superen el horario (un día completo)', async () => {
    prisma.space.findMany.mockResolvedValue([
      { id: 's1', name: 'Sala', status: 'ACTIVE', rulesWeek: [monday('09:00', '10:00')] },
    ]);
    prisma.booking.findMany.mockResolvedValue([booking('s1', 40, 100000)]);

    const { spaces } = await service.metrics('u1', '2026-10');

    expect(spaces[0]).toMatchObject({ bookedHours: 40, availableHours: 4, occupancy: 1 });
  });

  it('reparte las reservas entre los espacios y suma el total', async () => {
    prisma.space.findMany.mockResolvedValue([
      { id: 's1', name: 'A', status: 'ACTIVE', rulesWeek: [monday()] },
      { id: 's2', name: 'B', status: 'INACTIVE', rulesWeek: [] },
    ]);
    prisma.booking.findMany.mockResolvedValue([
      booking('s1', 2, 20000),
      booking('s1', 1, 10000),
      booking('s2', 1, 7000),
    ]);

    const result = await service.metrics('u1', '2026-10');

    expect(result).toMatchObject({ month: '2026-10', income: 37000, bookings: 3 });
    expect(result.spaces.map((s) => [s.name, s.income, s.bookings])).toEqual([
      ['A', 30000, 2],
      ['B', 7000, 1],
    ]);
    expect(result.spaces[1].occupancy).toBeNull();
  });

  it('sin espacios todo es cero', async () => {
    prisma.space.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);

    await expect(service.metrics('u1', '2026-10')).resolves.toEqual({
      month: '2026-10',
      income: 0,
      bookings: 0,
      spaces: [],
    });
  });
});
