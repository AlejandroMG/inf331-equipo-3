import { BadRequestException, ConflictException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AvailabilityService } from '../availability/availability.service';
import { BookingStatus } from '../generated/prisma/enums';
import { CHECKOUT_GATEWAY } from '../payments/checkout-gateway';
import { PrismaService } from '../prisma/prisma.service';
import { BookingExpiryService } from './booking-expiry.service';
import { BookingStateService } from './booking-state.service';
import { BOOKING_VIEW } from './booking-view';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { OVERLAP_MESSAGE } from './overlap-error';
import { overlapViolation } from './overlap-error.fixture';

const NOW = new Date('2026-10-10T12:00:00.000Z');
const HOUR = 3_600_000;
const DTO = { reason: 'Se suspendió la reunión' };

describe('BookingsService.cancel', () => {
  let service: BookingsService;
  let warn: jest.SpyInstance;
  // El mismo objeto hace de cliente y de cliente de transacción.
  const prisma = {
    $transaction: jest.fn(),
    booking: { findUnique: jest.fn(), updateMany: jest.fn() },
  };
  const state = { transition: jest.fn() };

  /** Una reserva del arrendatario `renter` en un espacio de `owner`, que parte en 48 horas. */
  const stored = (status: BookingStatus, extra: Record<string, unknown> = {}) => {
    const booking = {
      id: 'b1',
      spaceId: 's1',
      renterId: 'renter',
      status,
      unit: 'HOUR',
      startAt: new Date(NOW.getTime() + 48 * HOUR),
      endAt: new Date(NOW.getTime() + 50 * HOUR),
      subtotal: 24000,
      fee: 2400,
      total: 26400,
      expiresAt: null,
      createdAt: new Date('2026-10-09T12:00:00.000Z'),
      space: {
        id: 's1',
        name: 'Sala Alameda',
        ownerId: 'owner',
        address: 'Alameda 123',
        addressDetail: 'Oficina 402',
        commune: { name: 'Santiago' },
        photos: [{ url: 'https://fotos.test/1.jpg' }],
      },
      ...extra,
    };
    prisma.booking.findUnique.mockResolvedValue(booking);
    return booking;
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] });
    prisma.$transaction.mockImplementation((run: (tx: typeof prisma) => unknown) => run(prisma));
    prisma.booking.updateMany.mockResolvedValue({ count: 1 });
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const module = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: BookingStateService, useValue: state },
        // Cancelar no reserva: estos tres no se usan aquí.
        { provide: AvailabilityService, useValue: {} },
        { provide: BookingExpiryService, useValue: {} },
        { provide: CHECKOUT_GATEWAY, useValue: {} },
      ],
    }).compile();
    service = module.get(BookingsService);
  });

  afterEach(() => {
    jest.useRealTimers();
    warn.mockRestore();
  });

  it.each([
    ['el arrendatario', 'renter'],
    ['el dueño del espacio', 'owner'],
  ])('%s cancela una reserva confirmada: queda el evento con su id y el motivo', async (_name, userId) => {
    stored('CONFIRMED');

    const cancelled = await service.cancel(userId, 'b1', DTO);

    expect(prisma.booking.findUnique).toHaveBeenCalledWith({ where: { id: 'b1' }, include: BOOKING_VIEW });
    expect(state.transition).toHaveBeenCalledTimes(1);
    expect(state.transition).toHaveBeenCalledWith('b1', 'CANCELLED', { actorId: userId, reason: DTO.reason }, prisma);
    expect(cancelled).toEqual({
      id: 'b1',
      status: 'CANCELLED',
      unit: 'HOUR',
      startAt: new Date(NOW.getTime() + 48 * HOUR),
      endAt: new Date(NOW.getTime() + 50 * HOUR),
      subtotal: 24000,
      fee: 2400,
      total: 26400,
      expiresAt: null,
      createdAt: new Date('2026-10-09T12:00:00.000Z'),
      // Cancelada, ya no muestra el detalle privado de la dirección (P-09).
      space: {
        id: 's1',
        name: 'Sala Alameda',
        communeName: 'Santiago',
        address: 'Alameda 123',
        addressDetail: null,
        coverUrl: 'https://fotos.test/1.jpg',
      },
    });
  });

  it('un espacio sin comuna ni fotos responde null en esos campos', async () => {
    const booking = stored('CONFIRMED');
    booking.space = { ...booking.space, commune: null as never, photos: [] };

    const cancelled = await service.cancel('renter', 'b1', DTO);

    expect(cancelled.space).toMatchObject({ communeName: null, coverUrl: null });
  });

  it('una pendiente que no ha vencido se cancela, sin nada que reembolsar', async () => {
    stored('PENDING', { expiresAt: new Date(NOW.getTime() + 60_000) });

    const cancelled = await service.cancel('renter', 'b1', DTO);

    expect(cancelled.status).toBe('CANCELLED');
    expect(state.transition).toHaveBeenCalledWith('b1', 'CANCELLED', { actorId: 'renter', reason: DTO.reason }, prisma);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ['hace un minuto', -60_000],
    ['justo ahora', 0],
  ])('una pendiente cuyo plazo venció %s pasa a EXPIRED por el sistema y responde 409', async (_name, ms) => {
    stored('PENDING', { expiresAt: new Date(NOW.getTime() + ms) });

    await expect(service.cancel('renter', 'b1', DTO)).rejects.toThrow(ConflictException);

    expect(state.transition).toHaveBeenCalledTimes(1);
    expect(state.transition).toHaveBeenCalledWith('b1', 'EXPIRED', { actorId: null, reason: 'Venció el plazo de pago' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['PAID', 'FINISHED', 'CANCELLED', 'EXPIRED'] as const)('una reserva %s responde 409 y no cambia', async (status) => {
    stored(status);

    await expect(service.cancel('renter', 'b1', DTO)).rejects.toThrow(ConflictException);
    await expect(service.cancel('owner', 'b1', DTO)).rejects.toThrow(ConflictException);

    expect(state.transition).not.toHaveBeenCalled();
  });

  it.each([
    ['terminó hace una hora', -HOUR],
    ['termina justo ahora', 0],
  ])('una confirmada cuyo horario %s responde 409, sin cambiarla ni calcular reembolso', async (_name, ms) => {
    stored('CONFIRMED', { startAt: new Date(NOW.getTime() + ms - 2 * HOUR), endAt: new Date(NOW.getTime() + ms) });

    await expect(service.cancel('owner', 'b1', DTO)).rejects.toThrow('La reserva ya terminó; no se puede cancelar');
    await expect(service.cancel('renter', 'b1', DTO)).rejects.toThrow(ConflictException);

    expect(state.transition).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('una confirmada que todavía no termina (en curso) sí se cancela', async () => {
    stored('CONFIRMED', { startAt: new Date(NOW.getTime() - HOUR), endAt: new Date(NOW.getTime() + 1) });

    const cancelled = await service.cancel('owner', 'b1', DTO);

    expect(cancelled.status).toBe('CANCELLED');
  });

  it('responde 404 si la reserva no existe', async () => {
    prisma.booking.findUnique.mockResolvedValue(null);

    await expect(service.cancel('renter', 'b1', DTO)).rejects.toThrow(NotFoundException);
    expect(state.transition).not.toHaveBeenCalled();
  });

  it('responde 403 a quien no es el arrendatario ni el dueño del espacio, aunque la reserva ya no se pueda cancelar', async () => {
    stored('CONFIRMED');
    await expect(service.cancel('otro', 'b1', DTO)).rejects.toThrow(ForbiddenException);

    stored('FINISHED');
    await expect(service.cancel('otro', 'b1', DTO)).rejects.toThrow(ForbiddenException);

    stored('PENDING', { expiresAt: new Date(NOW.getTime() - 60_000) });
    await expect(service.cancel('otro', 'b1', DTO)).rejects.toThrow(ForbiddenException);
    expect(state.transition).not.toHaveBeenCalled();
  });

  it('si la reserva cambió de estado entre la revisión y la cancelación responde 409 y no la cancela', async () => {
    stored('PENDING', { expiresAt: new Date(NOW.getTime() + 60_000) });
    // Llegó el pago en el intertanto: la fila ya no está en PENDING.
    prisma.booking.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.cancel('renter', 'b1', DTO)).rejects.toThrow(ConflictException);

    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'b1', status: 'PENDING' },
      data: { status: 'PENDING' },
    });
    expect(state.transition).not.toHaveBeenCalled();
  });

  it('si la transición falla, el error sale tal cual', async () => {
    stored('CONFIRMED');
    state.transition.mockRejectedValue(new ConflictException('otro cambio ganó'));

    await expect(service.cancel('renter', 'b1', DTO)).rejects.toThrow('otro cambio ganó');
    expect(warn).not.toHaveBeenCalled();
  });

  describe('reembolso pendiente de PA-03', () => {
    const startsIn = (hours: number) => ({ startAt: new Date(NOW.getTime() + hours * HOUR) });

    it.each([
      ['el arrendatario con 24 horas exactas', 'renter', 24, true],
      ['el arrendatario con 23 horas', 'renter', 23, false],
      ['el propietario con 23 horas', 'owner', 23, true],
      ['el propietario con 1 hora', 'owner', 1, true],
    ])('cancela %s', async (_name, userId, hours, refunded) => {
      stored('CONFIRMED', startsIn(hours));

      await service.cancel(userId, 'b1', DTO);

      if (refunded) expect(warn).toHaveBeenCalledWith(expect.stringContaining('26400 CLP'));
      else expect(warn).not.toHaveBeenCalled();
    });
  });
});

// RE-02: reservar y consultar. La base, la disponibilidad, los vencimientos y el checkout son dobles de prueba;
// la lógica contra la base de verdad está en test/booking-create.e2e-spec.ts.
describe('BookingsService (RE-02)', () => {
  let service: BookingsService;
  // `tx` es el cliente de la transacción; `prisma` el de afuera. Se distinguen para comprobar que todo pasa en `tx`.
  const tx = {
    $executeRaw: jest.fn(),
    space: { findUnique: jest.fn() },
    booking: { create: jest.fn(), update: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    booking: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
  };
  const state = { recordCreation: jest.fn() };
  const availability = { isAvailable: jest.fn() };
  const expiry = { expireStalePending: jest.fn() };
  const checkout = { createSession: jest.fn() };

  // Lunes 14 de octubre de 2030, de 10:00 a 12:00 en Chile; el reloj está un día antes.
  const CLOCK = new Date('2030-10-13T15:07:00.000Z');
  const HOURLY = {
    spaceId: 's1',
    startAt: '2030-10-14T13:00:00.000Z',
    endAt: '2030-10-14T15:00:00.000Z',
    unit: 'HOUR',
  } satisfies CreateBookingDto;
  const SPACE = { id: 's1', name: 'Sala Alameda', ownerId: 'owner', status: 'ACTIVE', pricePerHour: 12000, pricePerDay: 90000 };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((run: (client: typeof tx) => unknown) => run(tx));
    tx.space.findUnique.mockResolvedValue(SPACE);
    tx.booking.create.mockResolvedValue({ id: 'b1' });
    expiry.expireStalePending.mockResolvedValue({ changed: 0, skipped: 0, failed: 0 });
    availability.isAvailable.mockResolvedValue(true);
    checkout.createSession.mockResolvedValue({ url: 'http://front.test/bookings/b1' });
    const module = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: BookingStateService, useValue: state },
        { provide: AvailabilityService, useValue: availability },
        { provide: BookingExpiryService, useValue: expiry },
        { provide: CHECKOUT_GATEWAY, useValue: checkout },
      ],
    }).compile();
    service = module.get(BookingsService);
  });

  describe('create', () => {
    it('crea la reserva PENDING con los montos del servidor y una retención de 30 minutos, y devuelve el checkout', async () => {
      const result = await service.create('renter', HOURLY, CLOCK);

      expect(result).toEqual({ bookingId: 'b1', checkoutUrl: 'http://front.test/bookings/b1' });
      expect(tx.booking.create).toHaveBeenCalledWith({
        data: {
          spaceId: 's1',
          renterId: 'renter',
          startAt: new Date(HOURLY.startAt),
          endAt: new Date(HOURLY.endAt),
          unit: 'HOUR',
          subtotal: 24000,
          fee: 2400,
          total: 26400,
          expiresAt: new Date('2030-10-13T15:37:00.000Z'),
        },
        select: { id: true },
      });
      expect(state.recordCreation).toHaveBeenCalledWith('b1', { actorId: 'renter' }, tx);
      expect(checkout.createSession).toHaveBeenCalledWith({
        id: 'b1',
        spaceName: 'Sala Alameda',
        subtotal: 24000,
        fee: 2400,
        total: 26400,
        expiresAt: new Date('2030-10-13T15:37:00.000Z'),
      });
      // Sin id de sesión (el checkout provisorio), no hay nada que guardar.
      expect(tx.booking.update).not.toHaveBeenCalled();
    });

    it('por día cobra el precio por día y revisa la disponibilidad como día completo', async () => {
      const daily = { ...HOURLY, endAt: '2030-10-15T00:00:00.000Z', unit: 'DAY' as const };

      await service.create('renter', daily, CLOCK);

      expect(availability.isAvailable).toHaveBeenCalledWith('s1', new Date(daily.startAt), new Date(daily.endAt), {
        tx,
        now: CLOCK,
        unit: 'DAY',
      });
      expect(tx.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ unit: 'DAY', subtotal: 90000, fee: 9000, total: 99000 }) }),
      );
    });

    it('expira las pendientes vencidas del espacio antes de revisar la disponibilidad, en la misma transacción', async () => {
      const calls: string[] = [];
      expiry.expireStalePending.mockImplementation(() => {
        calls.push('expire');
        return Promise.resolve({ changed: 1, skipped: 0, failed: 0 });
      });
      availability.isAvailable.mockImplementation(() => {
        calls.push('isAvailable');
        return Promise.resolve(true);
      });

      await service.create('renter', HOURLY, CLOCK);

      expect(calls).toEqual(['expire', 'isAvailable']);
      expect(expiry.expireStalePending).toHaveBeenCalledWith(tx, CLOCK, 's1');
      expect(availability.isAvailable).toHaveBeenCalledWith('s1', new Date(HOURLY.startAt), new Date(HOURLY.endAt), {
        tx,
        now: CLOCK,
        unit: 'HOUR',
      });
    });

    it('guarda el id de la sesión de pago si el checkout lo entrega (PA-01)', async () => {
      checkout.createSession.mockResolvedValue({ url: 'https://checkout.stripe.test/cs_1', sessionId: 'cs_1' });

      const result = await service.create('renter', HOURLY, CLOCK);

      expect(result.checkoutUrl).toBe('https://checkout.stripe.test/cs_1');
      expect(tx.booking.update).toHaveBeenCalledWith({ where: { id: 'b1' }, data: { stripeCheckoutSessionId: 'cs_1' } });
    });

    it('sin reloj usa la hora actual', async () => {
      jest.useFakeTimers({ now: CLOCK, doNotFake: ['nextTick', 'setImmediate'] });
      try {
        await service.create('renter', HOURLY);
      } finally {
        jest.useRealTimers();
      }

      expect(expiry.expireStalePending).toHaveBeenCalledWith(tx, CLOCK, 's1');
    });

    it.each([
      ['no existe', null],
      ['es un borrador', { ...SPACE, status: 'DRAFT' }],
      ['está desactivado', { ...SPACE, status: 'INACTIVE' }],
      ['está bloqueado', { ...SPACE, status: 'BLOCKED' }],
    ])('responde 404 si el espacio %s', async (_name, space) => {
      tx.space.findUnique.mockResolvedValue(space);

      await expect(service.create('renter', HOURLY, CLOCK)).rejects.toThrow(NotFoundException);
      expect(tx.booking.create).not.toHaveBeenCalled();
    });

    it.each([
      ['hora', 'HOUR', { pricePerHour: null }],
      ['día', 'DAY', { pricePerDay: null }],
    ] as const)('responde 400 si el espacio no se arrienda por %s', async (word, unit, prices) => {
      tx.space.findUnique.mockResolvedValue({ ...SPACE, ...prices });

      const error = await service.create('renter', { ...HOURLY, unit }, CLOCK).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as Error).message).toBe(`Este espacio no se arrienda por ${word}`);
      expect(availability.isAvailable).not.toHaveBeenCalled();
    });

    it.each([
      ['ya pasó', '2030-10-13T13:00:00.000Z', '2030-10-13T14:00:00.000Z'],
      ['ya empezó', '2030-10-13T15:00:00.000Z', '2030-10-13T16:00:00.000Z'],
      ['termina antes de empezar', '2030-10-14T15:00:00.000Z', '2030-10-14T13:00:00.000Z'],
      ['dura cero horas', '2030-10-14T13:00:00.000Z', '2030-10-14T13:00:00.000Z'],
    ])('responde 400 si el horario %s, sin abrir la transacción', async (_name, startAt, endAt) => {
      await expect(service.create('renter', { ...HOURLY, startAt, endAt }, CLOCK)).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('un bloque que empieza justo ahora ya pasó: 400', async () => {
      const now = new Date(HOURLY.startAt);

      await expect(service.create('renter', HOURLY, now)).rejects.toThrow(BadRequestException);
    });

    it('responde 403 si quien reserva es el dueño del espacio', async () => {
      await expect(service.create('owner', HOURLY, CLOCK)).rejects.toThrow(ForbiddenException);
      expect(availability.isAvailable).not.toHaveBeenCalled();
      expect(tx.booking.create).not.toHaveBeenCalled();
    });

    it('responde 409 si el horario no está disponible, sin crear la reserva ni pedir el checkout', async () => {
      availability.isAvailable.mockResolvedValue(false);

      await expect(service.create('renter', HOURLY, CLOCK)).rejects.toThrow(ConflictException);
      expect(tx.booking.create).not.toHaveBeenCalled();
      expect(checkout.createSession).not.toHaveBeenCalled();
    });

    describe('reservas simultáneas (RE-03)', () => {
      it('toma el lock del espacio en la transacción, con el id como parámetro, antes de expirar y revisar', async () => {
        const calls: string[] = [];
        tx.$executeRaw.mockImplementation(() => {
          calls.push('lock');
          return Promise.resolve(1);
        });
        expiry.expireStalePending.mockImplementation(() => {
          calls.push('expire');
          return Promise.resolve({ changed: 0, skipped: 0, failed: 0 });
        });
        availability.isAvailable.mockImplementation(() => {
          calls.push('isAvailable');
          return Promise.resolve(true);
        });

        await service.create('renter', HOURLY, CLOCK);

        expect(calls).toEqual(['lock', 'expire', 'isAvailable']);
        expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
        const [sql, ...values] = tx.$executeRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
        expect(sql.join('$')).toBe('SELECT pg_advisory_xact_lock(hashtextextended($, 0))');
        // El id va como parámetro de la consulta, nunca dentro del texto SQL.
        expect(values).toEqual(['s1']);
      });

      it('no toma el lock si el espacio no existe, es del que reserva o no tiene precio en esa unidad', async () => {
        tx.space.findUnique.mockResolvedValueOnce(null);
        await expect(service.create('renter', HOURLY, CLOCK)).rejects.toThrow(NotFoundException);
        await expect(service.create('owner', HOURLY, CLOCK)).rejects.toThrow(ForbiddenException);
        tx.space.findUnique.mockResolvedValueOnce({ ...SPACE, pricePerHour: null });
        await expect(service.create('renter', HOURLY, CLOCK)).rejects.toThrow(BadRequestException);

        expect(tx.$executeRaw).not.toHaveBeenCalled();
      });

      it('si booking_no_overlap rechaza el INSERT (otra solicitud ganó la carrera), responde 409 sin pedir el checkout', async () => {
        tx.booking.create.mockRejectedValue(overlapViolation());

        const error = await service.create('renter', HOURLY, CLOCK).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ConflictException);
        expect((error as Error).message).toBe(OVERLAP_MESSAGE);
        expect(checkout.createSession).not.toHaveBeenCalled();
      });

      it('traduce la violación aunque salga de la transacción completa y no del callback', async () => {
        prisma.$transaction.mockRejectedValue(overlapViolation());

        await expect(service.create('renter', HOURLY, CLOCK)).rejects.toThrow(ConflictException);
      });

      it('deja pasar tal cual cualquier otro error de la base', async () => {
        const other = overlapViolation({ message: 'violates exclusion constraint "otra_restriccion"' });
        tx.booking.create.mockRejectedValue(other);

        await expect(service.create('renter', HOURLY, CLOCK)).rejects.toBe(other);
      });
    });

    it('si el checkout falla, el error sale desde dentro del callback de la transacción', async () => {
      checkout.createSession.mockRejectedValue(new Error('Stripe no responde'));

      await expect(service.create('renter', HOURLY, CLOCK)).rejects.toThrow('Stripe no responde');
      // Con el doble de $transaction no se puede ver el rollback: que Prisma deshaga la reserva y su evento lo prueba
      // test/booking-create.e2e-spec.ts con un gateway que falla.
      expect(tx.booking.create).toHaveBeenCalled();
      expect(state.recordCreation).toHaveBeenCalled();
    });

    it('responde 400 si el rango dura más de 31 días, sin abrir la transacción', async () => {
      const longer = { ...HOURLY, endAt: '2030-11-14T14:00:00.000Z' };

      const error = await service.create('renter', longer, CLOCK).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as Error).message).toBe('Una reserva no puede durar más de 31 días');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('responde 400 si el total no cabe en un Int de Postgres, antes de insertar', async () => {
      // 20 horas a $100.000.000: subtotal 2.000.000.000 y total 2.200.000.000, más que 2.147.483.647.
      tx.space.findUnique.mockResolvedValue({ ...SPACE, pricePerHour: 100_000_000 });
      const twentyHours = { ...HOURLY, endAt: '2030-10-15T09:00:00.000Z' };

      const error = await service.create('renter', twentyHours, CLOCK).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as Error).message).toContain('supera el máximo permitido (2147483647 CLP)');
      expect(tx.booking.create).not.toHaveBeenCalled();
    });

    it('un total justo en el máximo sí se guarda', async () => {
      // 1 hora: subtotal 1.952.257.861 y comisión 195.225.786 suman exactamente 2.147.483.647.
      tx.space.findUnique.mockResolvedValue({ ...SPACE, pricePerHour: 1_952_257_861 });
      const oneHour = { ...HOURLY, endAt: '2030-10-14T14:00:00.000Z' };

      await service.create('renter', oneHour, CLOCK);

      expect(tx.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ total: 2_147_483_647 }) }),
      );
    });
  });

  /** Una reserva guardada con lo que carga `BOOKING_VIEW`. */
  const stored = (id: string, renterId = 'renter', status: BookingStatus = 'PENDING') => ({
    id,
    spaceId: 's1',
    renterId,
    status,
    unit: 'HOUR',
    startAt: new Date('2030-10-14T13:00:00.000Z'),
    endAt: new Date('2030-10-14T15:00:00.000Z'),
    subtotal: 24000,
    fee: 2400,
    total: 26400,
    expiresAt: new Date('2030-10-13T15:37:00.000Z'),
    createdAt: new Date('2030-10-13T15:07:00.000Z'),
    space: {
      id: 's1',
      name: 'Sala Alameda',
      ownerId: 'owner',
      address: 'Alameda 123',
      addressDetail: 'Oficina 402',
      commune: { name: 'Santiago' },
      photos: [],
    },
  });

  describe('findMine', () => {
    it('trae una página de mis reservas, las más recientes primero, con el total', async () => {
      prisma.booking.findMany.mockResolvedValue([stored('b2'), stored('b1')]);
      prisma.booking.count.mockResolvedValue(7);

      const page = await service.findMine('renter', { page: 2, pageSize: 5 });

      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: { renterId: 'renter' },
        include: BOOKING_VIEW,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 5,
        take: 5,
      });
      expect(prisma.booking.count).toHaveBeenCalledWith({ where: { renterId: 'renter' } });
      expect(page).toMatchObject({ total: 7, page: 2, pageSize: 5 });
      expect(page.items.map((item) => item.id)).toEqual(['b2', 'b1']);
      // Sin confirmar, el detalle privado de la dirección no sale (P-09).
      expect(page.items[0].space).toEqual({
        id: 's1',
        name: 'Sala Alameda',
        communeName: 'Santiago',
        address: 'Alameda 123',
        addressDetail: null,
        coverUrl: null,
      });
    });

    it('sin reservas responde una página vacía', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(0);

      await expect(service.findMine('renter', { page: 1, pageSize: 20 })).resolves.toEqual({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });
    });
  });

  describe('findOne', () => {
    it('devuelve mi reserva con el desglose, y el detalle de la dirección si está confirmada', async () => {
      prisma.booking.findUnique.mockResolvedValue(stored('b1', 'renter', 'CONFIRMED'));

      const booking = await service.findOne('renter', 'b1');

      expect(prisma.booking.findUnique).toHaveBeenCalledWith({ where: { id: 'b1' }, include: BOOKING_VIEW });
      expect(booking).toMatchObject({ id: 'b1', status: 'CONFIRMED', subtotal: 24000, fee: 2400, total: 26400 });
      expect(booking.space.addressDetail).toBe('Oficina 402');
    });

    it('responde 404 si la reserva no existe', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);

      await expect(service.findOne('renter', 'b1')).rejects.toThrow(NotFoundException);
    });

    it('responde 403 si la reserva es de otro usuario, también al dueño del espacio', async () => {
      prisma.booking.findUnique.mockResolvedValue(stored('b1', 'renter'));

      await expect(service.findOne('otro', 'b1')).rejects.toThrow(ForbiddenException);
      await expect(service.findOne('owner', 'b1')).rejects.toThrow(ForbiddenException);
    });
  });
});
