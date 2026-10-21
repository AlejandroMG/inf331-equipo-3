import { ConflictException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BookingStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStateService } from './booking-state.service';
import { BOOKING_VIEW } from './booking-view';
import { BookingsService } from './bookings.service';

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
