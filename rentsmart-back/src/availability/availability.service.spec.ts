import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from './availability.service';
import { scheduleError, sortRules } from './schedule-rules';

const rule = (weekday: number, startTime: string, endTime: string) => ({ weekday, startTime, endTime });

describe('schedule-rules', () => {
  it('ordena por día y hora de inicio', () => {
    expect(sortRules([rule(2, '09:00', '10:00'), rule(1, '15:00', '18:00'), rule(1, '09:00', '13:00')])).toEqual([
      rule(1, '09:00', '13:00'),
      rule(1, '15:00', '18:00'),
      rule(2, '09:00', '10:00'),
    ]);
  });

  it.each([
    ['un horario vacío', []],
    ['un rango de una hora', [rule(1, '09:00', '10:00')]],
    ['el día completo, hasta las 24:00', [rule(0, '00:00', '24:00')]],
    ['dos rangos contiguos', [rule(1, '09:00', '13:00'), rule(1, '13:00', '18:00')]],
    ['contiguos hasta las 24:00, en desorden', [rule(1, '20:00', '24:00'), rule(1, '09:00', '20:00')]],
    ['las mismas horas en días distintos', [rule(1, '09:00', '13:00'), rule(2, '09:00', '13:00')]],
  ])('vale %s', (_name, rules) => {
    expect(scheduleError(rules)).toBeNull();
  });

  it.each([
    ['un fin igual al inicio', [rule(1, '09:00', '09:00')]],
    ['un fin anterior al inicio', [rule(1, '12:00', '09:00')]],
  ])('no vale %s', (_name, rules) => {
    expect(scheduleError(rules)).toBe('El fin de cada rango debe ser posterior a su inicio');
  });

  it.each([
    ['dos rangos que se cruzan una hora', [rule(1, '09:00', '13:00'), rule(1, '12:00', '18:00')]],
    ['un rango dentro de otro', [rule(1, '09:00', '18:00'), rule(1, '11:00', '12:00')]],
    ['el mismo rango dos veces', [rule(3, '09:00', '10:00'), rule(3, '09:00', '10:00')]],
    ['un cruce con las 24:00, en desorden', [rule(6, '22:00', '24:00'), rule(6, '09:00', '23:00')]],
  ])('no vale %s', (_name, rules) => {
    expect(scheduleError(rules)).toBe('Los rangos de un mismo día no pueden traslaparse');
  });
});

describe('AvailabilityService (horario semanal)', () => {
  let service: AvailabilityService;
  const prisma = {
    $transaction: jest.fn(),
    space: { findUnique: jest.fn() },
    availabilityRule: { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
  };
  const space = (status: string, ownerId = 'owner') => prisma.space.findUnique.mockResolvedValue({ ownerId, status });

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockResolvedValue([]);
    prisma.availabilityRule.deleteMany.mockReturnValue('borrar');
    prisma.availabilityRule.createMany.mockReturnValue('crear');
    const module = await Test.createTestingModule({
      providers: [AvailabilityService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AvailabilityService);
  });

  describe('findSchedule', () => {
    it('devuelve las reglas del espacio por día y hora de inicio', async () => {
      space('DRAFT');
      prisma.availabilityRule.findMany.mockResolvedValue([rule(1, '09:00', '21:00')]);

      await expect(service.findSchedule('owner', 's1')).resolves.toEqual({ rules: [rule(1, '09:00', '21:00')] });
      expect(prisma.availabilityRule.findMany).toHaveBeenCalledWith({
        where: { spaceId: 's1' },
        select: { weekday: true, startTime: true, endTime: true },
        orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
      });
    });

    it('responde 404 si el espacio no existe y 403 si es de otro', async () => {
      prisma.space.findUnique.mockResolvedValue(null);
      await expect(service.findSchedule('owner', 's1')).rejects.toThrow(NotFoundException);

      space('ACTIVE', 'otro');
      await expect(service.findSchedule('owner', 's1')).rejects.toThrow(ForbiddenException);
      expect(prisma.availabilityRule.findMany).not.toHaveBeenCalled();
    });
  });

  describe('replaceSchedule', () => {
    it('reemplaza el horario completo en una transacción y lo devuelve ordenado', async () => {
      space('ACTIVE');
      const rules = [rule(1, '13:00', '24:00'), rule(0, '10:00', '14:00'), rule(1, '09:00', '13:00')];

      const saved = await service.replaceSchedule('owner', 's1', { rules });

      const sorted = [rule(0, '10:00', '14:00'), rule(1, '09:00', '13:00'), rule(1, '13:00', '24:00')];
      expect(saved).toEqual({ rules: sorted });
      expect(prisma.availabilityRule.deleteMany).toHaveBeenCalledWith({ where: { spaceId: 's1' } });
      expect(prisma.availabilityRule.createMany).toHaveBeenCalledWith({
        data: sorted.map((item) => ({ ...item, spaceId: 's1' })),
      });
      expect(prisma.$transaction).toHaveBeenCalledWith(['borrar', 'crear']);
    });

    it('no guarda campos de más que vengan en una regla', async () => {
      space('DRAFT');
      const dirty = { ...rule(1, '09:00', '10:00'), spaceId: 'otro-espacio' };

      await service.replaceSchedule('owner', 's1', { rules: [dirty] });

      expect(prisma.availabilityRule.createMany).toHaveBeenCalledWith({
        data: [{ ...rule(1, '09:00', '10:00'), spaceId: 's1' }],
      });
    });

    it.each([
      ['un fin que no es posterior al inicio', [rule(1, '10:00', '10:00')]],
      ['rangos que se traslapan', [rule(1, '09:00', '13:00'), rule(1, '12:00', '18:00')]],
    ])('responde 400 con %s y no cambia nada', async (_name, rules) => {
      space('DRAFT');

      await expect(service.replaceSchedule('owner', 's1', { rules })).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('responde 409 con missing si deja sin horario a un espacio publicado', async () => {
      space('ACTIVE');

      const error = await service.replaceSchedule('owner', 's1', { rules: [] }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({ statusCode: 409, missing: ['schedule'] });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it.each(['DRAFT', 'INACTIVE', 'BLOCKED'])('un espacio %s sí puede quedar sin horario', async (status) => {
      space(status);

      await expect(service.replaceSchedule('owner', 's1', { rules: [] })).resolves.toEqual({ rules: [] });
      expect(prisma.availabilityRule.createMany).toHaveBeenCalledWith({ data: [] });
    });

    it('responde 404 si el espacio no existe y 403 si es de otro, sin cambiar nada', async () => {
      prisma.space.findUnique.mockResolvedValue(null);
      await expect(service.replaceSchedule('owner', 's1', { rules: [] })).rejects.toThrow(NotFoundException);

      space('DRAFT', 'otro');
      await expect(service.replaceSchedule('owner', 's1', { rules: [] })).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});

describe('AvailabilityService (disponibilidad)', () => {
  let service: AvailabilityService;
  const prisma = {
    space: { findUnique: jest.fn() },
    availabilityRule: { findMany: jest.fn() },
    booking: { findMany: jest.fn() },
  };
  const at = (iso: string) => new Date(iso);
  const booking = (startAt: string, endAt: string, status = 'CONFIRMED', expiresAt: string | null = null) => ({
    startAt: at(startAt),
    endAt: at(endAt),
    status,
    expiresAt: expiresAt ? at(expiresAt) : null,
  });
  // Lunes a viernes de 09:00 a 21:00 en Chile; el lunes 12 de octubre de 2026 eso es de 12:00 a 00:00 UTC.
  const WEEKDAYS = [1, 2, 3, 4, 5].map((weekday) => rule(weekday, '09:00', '21:00'));
  // El domingo 11 a mediodía en Chile, antes de todo lo que se consulta.
  const NOW = at('2026-10-11T15:00:00Z');
  const query = (from: string, to: string) => ({ from, to });
  const starts = (slots: Array<{ startAt: Date }>) => slots.map((slot) => slot.startAt.toISOString());

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.space.findUnique.mockResolvedValue({ status: 'ACTIVE' });
    prisma.availabilityRule.findMany.mockResolvedValue(WEEKDAYS);
    prisma.booking.findMany.mockResolvedValue([]);
    const module = await Test.createTestingModule({
      providers: [AvailabilityService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AvailabilityService);
  });

  describe('findAvailability', () => {
    it('devuelve un día por fecha pedida, con sus bloques libres en UTC', async () => {
      const result = await service.findAvailability('s1', query('2026-10-11', '2026-10-13'), NOW);

      expect(result.spaceId).toBe('s1');
      expect(result.timeZone).toBe('America/Santiago');
      expect(result.days.map((day) => day.date)).toEqual(['2026-10-11', '2026-10-12', '2026-10-13']);
      expect(result.days[0]).toEqual({ date: '2026-10-11', slots: [], fullDay: null });
      expect(result.days[1].slots).toHaveLength(12);
      expect(result.days[1].slots[0]).toEqual({ startAt: at('2026-10-12T12:00:00Z'), endAt: at('2026-10-12T13:00:00Z') });
      expect(result.days[1].fullDay).toEqual({
        startAt: at('2026-10-12T12:00:00Z'),
        endAt: at('2026-10-13T00:00:00Z'),
        available: true,
      });
    });

    it('lee las reglas y las reservas de todo el rango con una consulta cada una', async () => {
      await service.findAvailability('s1', query('2026-10-01', '2026-10-31'), NOW);

      expect(prisma.availabilityRule.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.availabilityRule.findMany).toHaveBeenCalledWith({
        where: { spaceId: 's1' },
        select: { weekday: true, startTime: true, endTime: true },
      });
      expect(prisma.booking.findMany).toHaveBeenCalledTimes(1);
      // Del 1 de octubre a las 00:00 al 1 de noviembre a las 00:00 en Chile, semiabierto: lt y gt, no lte ni gte.
      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: {
          spaceId: 's1',
          status: { in: ['PENDING', 'PAID', 'CONFIRMED'] },
          startAt: { lt: at('2026-11-01T03:00:00Z') },
          endAt: { gt: at('2026-10-01T03:00:00Z') },
        },
        select: { id: true, startAt: true, endAt: true, status: true, expiresAt: true },
      });
    });

    it('descuenta las reservas que retienen el horario, pero no una pendiente vencida', async () => {
      prisma.booking.findMany.mockResolvedValue([
        // 10:00 a 12:00 confirmada.
        booking('2026-10-12T13:00:00Z', '2026-10-12T15:00:00Z'),
        // 12:00 a 13:00, contigua, pendiente y vigente.
        booking('2026-10-12T15:00:00Z', '2026-10-12T16:00:00Z', 'PENDING', '2026-10-11T15:20:00Z'),
        // 15:00 a 16:00 pendiente, pero venció hace un minuto.
        booking('2026-10-12T18:00:00Z', '2026-10-12T19:00:00Z', 'PENDING', '2026-10-11T14:59:00Z'),
      ]);

      const { days } = await service.findAvailability('s1', query('2026-10-12', '2026-10-12'), NOW);

      expect(starts(days[0].slots)).toEqual([
        '2026-10-12T12:00:00.000Z',
        '2026-10-12T16:00:00.000Z',
        '2026-10-12T17:00:00.000Z',
        '2026-10-12T18:00:00.000Z',
        '2026-10-12T19:00:00.000Z',
        '2026-10-12T20:00:00.000Z',
        '2026-10-12T21:00:00.000Z',
        '2026-10-12T22:00:00.000Z',
        '2026-10-12T23:00:00.000Z',
      ]);
      expect(days[0].fullDay?.available).toBe(false);
    });

    it('no ofrece las horas que ya pasaron, con el reloj que recibe', async () => {
      const { days } = await service.findAvailability('s1', query('2026-10-12', '2026-10-13'), at('2026-10-12T20:10:00Z'));

      // Lunes a las 17:10 de Chile: quedan de 18:00 a 21:00; el martes está completo.
      expect(starts(days[0].slots)).toEqual([
        '2026-10-12T21:00:00.000Z',
        '2026-10-12T22:00:00.000Z',
        '2026-10-12T23:00:00.000Z',
      ]);
      expect(days[0].fullDay?.available).toBe(false);
      expect(days[1].slots).toHaveLength(12);
      expect(days[1].fullDay?.available).toBe(true);
    });

    it('acepta 31 días contando los dos extremos', async () => {
      const { days } = await service.findAvailability('s1', query('2026-10-01', '2026-10-31'), NOW);

      expect(days).toHaveLength(31);
      expect(days[30].date).toBe('2026-10-31');
    });

    it('un rango que cruza el cambio de hora de abril cuenta días del calendario', async () => {
      prisma.availabilityRule.findMany.mockResolvedValue([rule(6, '00:00', '24:00'), rule(0, '00:00', '24:00')]);

      const { days } = await service.findAvailability('s1', query('2026-04-04', '2026-04-05'), at('2026-01-01T00:00:00Z'));

      expect(days.map((day) => [day.date, day.slots.length])).toEqual([
        ['2026-04-04', 25],
        ['2026-04-05', 24],
      ]);
    });

    it.each([
      ['un día que no existe', query('2026-02-30', '2026-03-02')],
      ['un 31 de un mes de 30 días', query('2026-04-01', '2026-04-31')],
      ['from posterior a to', query('2026-10-13', '2026-10-12')],
      ['más de 31 días', query('2026-10-01', '2026-11-01')],
    ])('responde 400 con %s, sin consultar la base', async (_name, dates) => {
      await expect(service.findAvailability('s1', dates, NOW)).rejects.toThrow(BadRequestException);
      expect(prisma.space.findUnique).not.toHaveBeenCalled();
      expect(prisma.booking.findMany).not.toHaveBeenCalled();
    });

    it('responde 404 si el espacio no existe, sin leer las reservas', async () => {
      prisma.space.findUnique.mockResolvedValue(null);

      await expect(service.findAvailability('s1', query('2026-10-12', '2026-10-12'), NOW)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.booking.findMany).not.toHaveBeenCalled();
    });

    it.each(['DRAFT', 'INACTIVE', 'BLOCKED'])('responde 404 si el espacio está %s', async (status) => {
      prisma.space.findUnique.mockResolvedValue({ status });

      await expect(service.findAvailability('s1', query('2026-10-12', '2026-10-12'), NOW)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('isAvailable', () => {
    const MONDAY_10 = at('2026-10-12T13:00:00Z');
    const MONDAY_11 = at('2026-10-12T14:00:00Z');
    const MONDAY_12 = at('2026-10-12T15:00:00Z');
    const MONDAY_13 = at('2026-10-12T16:00:00Z');

    it('es verdadero en un espacio activo, dentro del horario, en el futuro y sin reservas', async () => {
      await expect(service.isAvailable('s1', MONDAY_10, MONDAY_12, { now: NOW })).resolves.toBe(true);
      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ spaceId: 's1', startAt: { lt: MONDAY_12 }, endAt: { gt: MONDAY_10 } }),
        }),
      );
    });

    it('reservas contiguas: una que termina a las 12:00 no choca con otra que empieza a las 12:00', async () => {
      prisma.booking.findMany.mockResolvedValue([booking('2026-10-12T13:00:00Z', '2026-10-12T15:00:00Z')]);

      await expect(service.isAvailable('s1', MONDAY_12, MONDAY_13, { now: NOW })).resolves.toBe(true);
      await expect(service.isAvailable('s1', MONDAY_11, MONDAY_13, { now: NOW })).resolves.toBe(false);
    });

    it.each([
      ['PAID', null, false],
      ['CONFIRMED', null, false],
      ['PENDING', '2026-10-11T15:30:00Z', false],
      ['PENDING', '2026-10-11T14:30:00Z', true],
    ])('una reserva %s (vence %s) que se cruza: disponible = %s', async (status, expiresAt, expected) => {
      prisma.booking.findMany.mockResolvedValue([booking('2026-10-12T13:00:00Z', '2026-10-12T14:00:00Z', status, expiresAt)]);

      await expect(service.isAvailable('s1', MONDAY_10, MONDAY_11, { now: NOW })).resolves.toBe(expected);
    });

    it('es falso si el rango ya empezó, sin consultar la base', async () => {
      await expect(service.isAvailable('s1', MONDAY_10, MONDAY_12, { now: at('2026-10-12T13:30:00Z') })).resolves.toBe(
        false,
      );
      expect(prisma.space.findUnique).not.toHaveBeenCalled();
    });

    it.each([
      ['una fecha inválida', at('no-es-fecha'), MONDAY_11],
      ['un fin anterior al inicio', MONDAY_12, MONDAY_10],
      ['minutos que no son una hora cerrada', at('2026-10-12T13:30:00Z'), MONDAY_12],
    ])('es falso con %s, sin consultar la base', async (_name, startAt, endAt) => {
      await expect(service.isAvailable('s1', startAt, endAt, { now: NOW })).resolves.toBe(false);
      expect(prisma.space.findUnique).not.toHaveBeenCalled();
      expect(prisma.booking.findMany).not.toHaveBeenCalled();
    });

    it('es falso fuera del horario semanal', async () => {
      // El sábado 17 no se arrienda.
      await expect(
        service.isAvailable('s1', at('2026-10-17T13:00:00Z'), at('2026-10-17T14:00:00Z'), { now: NOW }),
      ).resolves.toBe(false);
    });

    it.each([[null], [{ status: 'DRAFT' }], [{ status: 'INACTIVE' }], [{ status: 'BLOCKED' }]])(
      'es falso si el espacio es %j, sin leer el horario',
      async (space) => {
        prisma.space.findUnique.mockResolvedValue(space);

        await expect(service.isAvailable('s1', MONDAY_10, MONDAY_11, { now: NOW })).resolves.toBe(false);
        expect(prisma.availabilityRule.findMany).not.toHaveBeenCalled();
      },
    );

    it('con tx lee dentro de la transacción de quien llama, no con el cliente de siempre', async () => {
      const tx = {
        space: { findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE' }) },
        availabilityRule: { findMany: jest.fn().mockResolvedValue(WEEKDAYS) },
        booking: { findMany: jest.fn().mockResolvedValue([]) },
      };

      await expect(
        service.isAvailable('s1', MONDAY_10, MONDAY_11, { tx: tx as unknown as Prisma.TransactionClient, now: NOW }),
      ).resolves.toBe(true);
      expect(tx.space.findUnique).toHaveBeenCalled();
      expect(tx.availabilityRule.findMany).toHaveBeenCalled();
      expect(tx.booking.findMany).toHaveBeenCalled();
      expect(prisma.space.findUnique).not.toHaveBeenCalled();
      expect(prisma.booking.findMany).not.toHaveBeenCalled();
    });

    it('sin reloj usa la hora actual', async () => {
      // El lunes 12 de octubre de 2020 ya pasó.
      await expect(service.isAvailable('s1', at('2020-10-12T13:00:00Z'), at('2020-10-12T14:00:00Z'))).resolves.toBe(false);
    });
  });
});

describe('AvailabilityService.isAvailable (opciones de RE-02 y RE-04)', () => {
  let service: AvailabilityService;
  const prisma = {
    space: { findUnique: jest.fn() },
    availabilityRule: { findMany: jest.fn() },
    booking: { findMany: jest.fn() },
  };
  const at = (iso: string) => new Date(iso);
  const NOW = at('2026-10-11T15:00:00Z');
  // Lunes 12 de octubre de 2026: de 09:00 a 13:00 y de 15:00 a 18:00 en Chile.
  const SPLIT = [rule(1, '09:00', '13:00'), rule(1, '15:00', '18:00')];
  const DAY_START = at('2026-10-12T12:00:00Z');
  const DAY_END = at('2026-10-12T21:00:00Z');
  const MONDAY_10 = at('2026-10-12T13:00:00Z');
  const MONDAY_11 = at('2026-10-12T14:00:00Z');
  const own = { id: 'b1', startAt: MONDAY_10, endAt: MONDAY_11, status: 'PAID', expiresAt: null };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.space.findUnique.mockResolvedValue({ status: 'ACTIVE' });
    prisma.availabilityRule.findMany.mockResolvedValue(SPLIT);
    prisma.booking.findMany.mockResolvedValue([]);
    const module = await Test.createTestingModule({
      providers: [AvailabilityService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AvailabilityService);
  });

  it("con unit: 'DAY' acepta el fullDay de un día con pausa; por hora, no", async () => {
    await expect(service.isAvailable('s1', DAY_START, DAY_END, { now: NOW, unit: 'DAY' })).resolves.toBe(true);
    await expect(service.isAvailable('s1', DAY_START, DAY_END, { now: NOW })).resolves.toBe(false);
  });

  it("con unit: 'DAY' una reserva en la pausa lo impide", async () => {
    prisma.booking.findMany.mockResolvedValue([
      { id: 'b2', startAt: at('2026-10-12T16:00:00Z'), endAt: at('2026-10-12T17:00:00Z'), status: 'CONFIRMED', expiresAt: null },
    ]);

    await expect(service.isAvailable('s1', DAY_START, DAY_END, { now: NOW, unit: 'DAY' })).resolves.toBe(false);
  });

  it('excludeBookingId ignora esa reserva, y solo esa', async () => {
    prisma.booking.findMany.mockResolvedValue([own]);

    await expect(service.isAvailable('s1', MONDAY_10, MONDAY_11, { now: NOW })).resolves.toBe(false);
    await expect(service.isAvailable('s1', MONDAY_10, MONDAY_11, { now: NOW, excludeBookingId: 'b1' })).resolves.toBe(true);
    await expect(service.isAvailable('s1', MONDAY_10, MONDAY_11, { now: NOW, excludeBookingId: 'otra' })).resolves.toBe(
      false,
    );
  });

  it('allowStarted acepta el bloque pagado a las 10:02, y no uno que ya terminó', async () => {
    const at1002 = at('2026-10-12T13:02:00Z');

    await expect(service.isAvailable('s1', MONDAY_10, MONDAY_11, { now: at1002 })).resolves.toBe(false);
    await expect(service.isAvailable('s1', MONDAY_10, MONDAY_11, { now: at1002, allowStarted: true })).resolves.toBe(true);
    await expect(
      service.isAvailable('s1', MONDAY_10, MONDAY_11, { now: at('2026-10-12T14:00:00Z'), allowStarted: true }),
    ).resolves.toBe(false);
  });

  it('RE-04: valida su propia reserva PAID ya empezada con las dos opciones juntas', async () => {
    prisma.booking.findMany.mockResolvedValue([own]);

    await expect(
      service.isAvailable('s1', MONDAY_10, MONDAY_11, {
        now: at('2026-10-12T13:02:00Z'),
        excludeBookingId: 'b1',
        allowStarted: true,
      }),
    ).resolves.toBe(true);
  });
});
