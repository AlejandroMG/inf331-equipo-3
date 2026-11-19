import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AvailabilityService } from '../availability/availability.service';
import { BookingStatus, SpaceStatus } from '../generated/prisma/enums';
import { RefundNotRecordedError } from '../payments/payment-refund.service';
import { PAYMENT_REFUNDER } from '../payments/payment-refunder';
import { PrismaService } from '../prisma/prisma.service';
import {
  BOOKING_ENDED_REASON,
  BookingConfirmationService,
  CONFIRMED_REASON,
  SLOT_TAKEN_REASON,
  SPACE_UNAVAILABLE_REASON,
} from './booking-confirmation.service';
import { BookingStateService } from './booking-state.service';
import { overlapViolation } from './overlap-error.fixture';

// Reloj fijo: `confirm` lo recibe, y los límites se prueban contra él.
const NOW = new Date('2026-10-24T15:00:00.000Z');
const HOUR = 3_600_000;
const ID = 'b1';
const SPACE = 's1';
const AMOUNT = 26400;

describe('BookingConfirmationService', () => {
  let service: BookingConfirmationService;
  let errorLog: jest.SpyInstance;

  /** La reserva como la lee el servicio bajo el lock. */
  const locked = (extra: Record<string, unknown> = {}) => ({
    status: 'PAID' as BookingStatus,
    startAt: new Date(NOW.getTime() - HOUR),
    endAt: new Date(NOW.getTime() + HOUR),
    unit: 'HOUR',
    payment: { amount: AMOUNT },
    ...extra,
  });

  const tx = {
    $executeRaw: jest.fn(),
    // Sin `availabilityRule`: si la validación mirara el horario semanal, fallaría (enmienda a P-06).
    booking: { findUnique: jest.fn(), findMany: jest.fn() },
    space: { findUnique: jest.fn() },
  };
  const prisma = {
    booking: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const state = { transition: jest.fn() };
  /** Otra reserva que se cruza con el rango; `findMany` entrega lo que ya filtró por estado y rango. */
  const other = (extra: Record<string, unknown> = {}) => ({
    id: 'b2',
    startAt: new Date(NOW.getTime() - HOUR),
    endAt: new Date(NOW.getTime() + HOUR),
    status: 'CONFIRMED',
    expiresAt: null,
    ...extra,
  });
  const refunder = { refundBooking: jest.fn() };

  /** Deja una reserva `PAID` válida: cada caso cambia solo lo que prueba. */
  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((work: (client: typeof tx) => Promise<unknown>) => work(tx));
    prisma.booking.findUnique.mockResolvedValue({ status: 'PAID', spaceId: SPACE });
    tx.booking.findUnique.mockResolvedValue(locked());
    tx.space.findUnique.mockResolvedValue({ status: SpaceStatus.ACTIVE });
    tx.booking.findMany.mockResolvedValue([]);
    state.transition.mockResolvedValue({});
    refunder.refundBooking.mockResolvedValue(undefined);
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const module = await Test.createTestingModule({
      providers: [
        BookingConfirmationService,
        { provide: PrismaService, useValue: prisma },
        { provide: BookingStateService, useValue: state },
        // La real: la regla de quién ocupa el horario es la misma de la disponibilidad.
        AvailabilityService,
        { provide: PAYMENT_REFUNDER, useValue: refunder },
      ],
    }).compile();
    service = module.get(BookingConfirmationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const expectCancelled = (reason: string) => {
    expect(state.transition).toHaveBeenCalledTimes(1);
    expect(state.transition).toHaveBeenCalledWith(ID, 'CANCELLED', { actorId: null, reason }, tx);
    expect(refunder.refundBooking).toHaveBeenCalledTimes(1);
    expect(refunder.refundBooking).toHaveBeenCalledWith(ID, AMOUNT, expect.stringMatching(/^Sistema: /));
  };

  describe('éxito', () => {
    it('pasa a CONFIRMED como sistema, en la transacción, sin reembolsar', async () => {
      await expect(service.confirm(ID, NOW)).resolves.toBe('confirmed');

      expect(state.transition).toHaveBeenCalledTimes(1);
      expect(state.transition).toHaveBeenCalledWith(ID, 'CONFIRMED', { actorId: null, reason: CONFIRMED_REASON }, tx);
      expect(refunder.refundBooking).not.toHaveBeenCalled();
    });

    it('busca traslapes en la transacción, con los estados que ocupan el horario y su propio rango', async () => {
      const startAt = new Date(NOW.getTime() - HOUR);
      const endAt = new Date(NOW.getTime() + HOUR);
      tx.booking.findUnique.mockResolvedValue(locked({ startAt, endAt }));

      await service.confirm(ID, NOW);

      expect(tx.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            spaceId: SPACE,
            status: { in: ['PENDING', 'PAID', 'CONFIRMED'] },
            startAt: { lt: endAt },
            endAt: { gt: startAt },
          },
        }),
      );
    });

    it.each(['HOUR', 'DAY'])('confirma por %s sin mirar el horario semanal (enmienda a P-06)', async (unit) => {
      tx.booking.findUnique.mockResolvedValue(locked({ unit }));

      await expect(service.confirm(ID, NOW)).resolves.toBe('confirmed');
    });

    it('su propia reserva no cuenta como traslape', async () => {
      tx.booking.findMany.mockResolvedValue([other({ id: ID, status: 'PAID' })]);

      await expect(service.confirm(ID, NOW)).resolves.toBe('confirmed');
    });

    it('una PENDING vencida de otra reserva no cuenta como traslape, igual que en la disponibilidad', async () => {
      tx.booking.findMany.mockResolvedValue([other({ status: 'PENDING', expiresAt: NOW })]);

      await expect(service.confirm(ID, NOW)).resolves.toBe('confirmed');
    });

    it('toma el lock del espacio y vuelve a leer el estado después, en la transacción', async () => {
      await service.confirm(ID, NOW);

      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(tx.$executeRaw.mock.calls[0]).toContain(SPACE);
      expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.booking.findUnique.mock.invocationCallOrder[0]);
    });

    it('la transacción aguanta la espera de un create, que retiene el lock hasta 15 s', async () => {
      await service.confirm(ID, NOW);

      const [, options] = prisma.$transaction.mock.calls[0] as [unknown, { timeout: number }];
      expect(options.timeout).toBeGreaterThan(15_000);
    });

    it('sin reloj usa la hora actual: la misma reserva confirma antes de endAt y se cancela justo en endAt', async () => {
      jest.useFakeTimers({ now: new Date(NOW.getTime() - 1) });
      try {
        tx.booking.findUnique.mockResolvedValue(locked({ endAt: NOW }));
        await expect(service.confirm(ID)).resolves.toBe('confirmed');

        jest.setSystemTime(NOW);
        await expect(service.confirm(ID)).resolves.toBe('cancelled');
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('no hace nada', () => {
    it('si la reserva no existe', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);

      await expect(service.confirm(ID, NOW)).resolves.toBe('skipped');

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(refunder.refundBooking).not.toHaveBeenCalled();
    });

    it.each(['PENDING', 'CONFIRMED', 'FINISHED', 'CANCELLED', 'EXPIRED'] as const)('si está %s', async (status) => {
      prisma.booking.findUnique.mockResolvedValue({ status, spaceId: SPACE });

      await expect(service.confirm(ID, NOW)).resolves.toBe('skipped');

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(state.transition).not.toHaveBeenCalled();
    });

    it.each(['CONFIRMED', 'CANCELLED'] as const)(
      'si bajo el lock ya está %s: otra llamada ganó y no se reembolsa de nuevo',
      async (status) => {
        tx.booking.findUnique.mockResolvedValue(locked({ status }));

        await expect(service.confirm(ID, NOW)).resolves.toBe('skipped');

        expect(state.transition).not.toHaveBeenCalled();
        expect(refunder.refundBooking).not.toHaveBeenCalled();
      },
    );

    it('si bajo el lock ya no existe', async () => {
      tx.booking.findUnique.mockResolvedValue(null);

      await expect(service.confirm(ID, NOW)).resolves.toBe('skipped');

      expect(state.transition).not.toHaveBeenCalled();
    });
  });

  describe('cancela con reembolso total', () => {
    it.each([SpaceStatus.INACTIVE, SpaceStatus.BLOCKED, SpaceStatus.DRAFT])('si el espacio está %s', async (status) => {
      tx.space.findUnique.mockResolvedValue({ status });

      await expect(service.confirm(ID, NOW)).resolves.toBe('cancelled');

      expectCancelled(SPACE_UNAVAILABLE_REASON);
      expect(tx.booking.findMany).not.toHaveBeenCalled();
    });

    it('si el espacio ya no existe', async () => {
      tx.space.findUnique.mockResolvedValue(null);

      await expect(service.confirm(ID, NOW)).resolves.toBe('cancelled');

      expectCancelled(SPACE_UNAVAILABLE_REASON);
    });

    it.each([
      ['CONFIRMED', null],
      ['PAID', null],
      ['PENDING', new Date(NOW.getTime() + 1)],
      ['PENDING', null],
    ])('por HOUR, si otra reserva %s (plazo %s) se traslapa', async (status, expiresAt) => {
      tx.booking.findMany.mockResolvedValue([other({ status, expiresAt })]);

      await expect(service.confirm(ID, NOW)).resolves.toBe('cancelled');

      expectCancelled(SLOT_TAKEN_REASON);
    });

    it('si endAt ya pasó, y el límite cuenta como pasado', async () => {
      tx.booking.findUnique.mockResolvedValue(locked({ endAt: NOW }));

      await expect(service.confirm(ID, NOW)).resolves.toBe('cancelled');

      expectCancelled(BOOKING_ENDED_REASON);
      expect(tx.booking.findMany).not.toHaveBeenCalled();
    });

    it('un milisegundo antes de endAt todavía confirma', async () => {
      tx.booking.findUnique.mockResolvedValue(locked({ endAt: new Date(NOW.getTime() + 1) }));

      await expect(service.confirm(ID, NOW)).resolves.toBe('confirmed');
    });

    it('el reembolso se pide después de terminar la transacción', async () => {
      tx.booking.findMany.mockResolvedValue([other()]);
      let insideTransaction = false;
      prisma.$transaction.mockImplementation(async (work: (client: typeof tx) => Promise<unknown>) => {
        insideTransaction = true;
        const result = await work(tx);
        insideTransaction = false;
        return result;
      });
      refunder.refundBooking.mockImplementation(() => {
        expect(insideTransaction).toBe(false);
        return Promise.resolve();
      });

      await service.confirm(ID, NOW);

      expect(refunder.refundBooking).toHaveBeenCalledTimes(1);
    });

    it('reembolsa lo que dice el pago, y el motivo del log no lleva datos de la persona', async () => {
      tx.booking.findMany.mockResolvedValue([other()]);
      tx.booking.findUnique.mockResolvedValue(locked({ payment: { amount: 12345 }, total: 99999 }));

      await service.confirm(ID, NOW);

      expect(refunder.refundBooking).toHaveBeenCalledWith(ID, 12345, expect.stringMatching(/^Sistema: /));
    });

    it('sin pago no pide reembolso, y la reserva queda cancelada', async () => {
      tx.booking.findMany.mockResolvedValue([other()]);
      tx.booking.findUnique.mockResolvedValue(locked({ payment: null }));

      await expect(service.confirm(ID, NOW)).resolves.toBe('cancelled');

      expect(refunder.refundBooking).not.toHaveBeenCalled();
    });

    it('si el reembolso falla no lanza, queda cancelada y el log solo lleva ids, monto y el nombre del error', async () => {
      tx.booking.findMany.mockResolvedValue([other()]);
      const failure = new TypeError('sk_test_detalle_interno_del_proveedor');
      refunder.refundBooking.mockRejectedValue(failure);

      await expect(service.confirm(ID, NOW)).resolves.toBe('cancelled');

      expect(state.transition).toHaveBeenCalledWith(ID, 'CANCELLED', expect.anything(), tx);
      expect(errorLog).toHaveBeenCalledTimes(1);
      const message = String(errorLog.mock.calls[0][0]);
      expect(message).toContain(ID);
      expect(message).toContain(String(AMOUNT));
      expect(message).toContain('TypeError');
      expect(message).not.toContain('sk_test');
    });
  });

  describe('si Stripe devolvió el dinero y falló la base', () => {
    it('no lanza, y el log dice que se devolvió y falta registrarlo, no que falló el reembolso', async () => {
      tx.booking.findMany.mockResolvedValue([other()]);
      refunder.refundBooking.mockRejectedValue(new RefundNotRecordedError('Stripe reembolsó, la base falló'));

      await expect(service.confirm(ID, NOW)).resolves.toBe('cancelled');

      expect(errorLog).toHaveBeenCalledTimes(1);
      const message = String(errorLog.mock.calls[0][0]);
      expect(message).toContain(ID);
      expect(message).toMatch(/Stripe devolvió .*falta registrarlo/);
      expect(message).not.toContain('falló el reembolso');
    });
  });

  describe('carreras', () => {
    it('un 409 de transition no se propaga ni reembolsa: otro cambio ganó', async () => {
      tx.booking.findMany.mockResolvedValue([other()]);
      state.transition.mockRejectedValue(new ConflictException('La reserva cambió de estado'));

      await expect(service.confirm(ID, NOW)).resolves.toBe('skipped');

      expect(refunder.refundBooking).not.toHaveBeenCalled();
    });

    it('un 404 de transition tampoco', async () => {
      state.transition.mockRejectedValue(new NotFoundException('La reserva no existe'));

      await expect(service.confirm(ID, NOW)).resolves.toBe('skipped');
    });

    it('una violación de booking_no_overlap deshace la transacción y deja la reserva como estaba, sin lanzar', async () => {
      state.transition.mockRejectedValue(overlapViolation());

      await expect(service.confirm(ID, NOW)).resolves.toBe('skipped');

      expect(refunder.refundBooking).not.toHaveBeenCalled();
      expect(errorLog).toHaveBeenCalledTimes(1);
    });
  });

  describe('fallos inesperados', () => {
    it('un error de la base al validar se propaga, sin cambiar ni reembolsar: lo reintenta el barrido', async () => {
      tx.booking.findMany.mockRejectedValue(new Error('se cayó la base'));

      await expect(service.confirm(ID, NOW)).rejects.toThrow('se cayó la base');

      expect(state.transition).not.toHaveBeenCalled();
      expect(refunder.refundBooking).not.toHaveBeenCalled();
    });

    it('un error al escribir la transición se propaga', async () => {
      state.transition.mockRejectedValue(new Error('deadlock'));

      await expect(service.confirm(ID, NOW)).rejects.toThrow('deadlock');

      expect(refunder.refundBooking).not.toHaveBeenCalled();
    });

    it('un error en la primera lectura también', async () => {
      prisma.booking.findUnique.mockRejectedValue(new Error('sin conexión'));

      await expect(service.confirm(ID, NOW)).rejects.toThrow('sin conexión');
    });
  });
});
