import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BookingStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { EXPIRED_REASON, FINISHED_REASON, BookingExpiryService } from './booking-expiry.service';
import { BookingStateService } from './booking-state.service';

// Reloj fijo: los límites se prueban contra esta hora, nunca contra la del sistema.
const NOW = new Date('2026-10-24T15:00:00.000Z');
const MS = 1;
const HOUR = 3_600_000;

interface Row {
  id: string;
  spaceId: string;
  status: BookingStatus;
  endAt: Date;
  expiresAt: Date | null;
}

interface FindManyArgs {
  where: {
    status: BookingStatus;
    spaceId?: string;
    id?: { gt: string };
    endAt?: { lte: Date };
    expiresAt?: { lte: Date };
  };
  take?: number;
}

describe('BookingExpiryService', () => {
  let service: BookingExpiryService;
  let rows: Row[];
  let errorLog: jest.SpyInstance;

  /** Un `booking.findMany` sobre `rows`, con los filtros que usa el servicio, ordenado por id. */
  const fakeFindMany = () =>
    jest.fn(({ where, take }: FindManyArgs) => {
      const found = rows
        .filter((row) => row.status === where.status)
        .filter((row) => !where.spaceId || row.spaceId === where.spaceId)
        .filter((row) => !where.id || row.id > where.id.gt)
        .filter((row) => !where.endAt || row.endAt <= where.endAt.lte)
        .filter((row) => !where.expiresAt || (row.expiresAt !== null && row.expiresAt <= where.expiresAt.lte))
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, take)
        .map((row) => ({ id: row.id }));
      return Promise.resolve(found);
    });
  const prisma = { booking: { findMany: fakeFindMany() } };
  // Por defecto la transición funciona y cambia la fila, como lo haría la base.
  const state = { transition: jest.fn() };

  const row = (id: string, status: BookingStatus, extra: Partial<Row> = {}): Row => {
    const created: Row = {
      id,
      spaceId: 's1',
      status,
      endAt: new Date(NOW.getTime() + HOUR),
      expiresAt: null,
      ...extra,
    };
    rows.push(created);
    return created;
  };
  const statusOf = (id: string) => rows.find((r) => r.id === id)?.status;
  const transitioned = () => state.transition.mock.calls.map(([id, to]) => [id, to]);

  beforeEach(async () => {
    jest.clearAllMocks();
    rows = [];
    state.transition.mockReset();
    state.transition.mockImplementation((id: string, to: BookingStatus) => {
      const target = rows.find((r) => r.id === id)!;
      target.status = to;
      return Promise.resolve({ ...target });
    });
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    const module = await Test.createTestingModule({
      providers: [
        BookingExpiryService,
        { provide: PrismaService, useValue: prisma },
        { provide: BookingStateService, useValue: state },
      ],
    }).compile();
    service = module.get(BookingExpiryService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('sweep: CONFIRMED → FINISHED', () => {
    it('finaliza la que termina justo ahora y no la que termina un milisegundo después', async () => {
      row('at-limit', 'CONFIRMED', { endAt: NOW });
      row('before-limit', 'CONFIRMED', { endAt: new Date(NOW.getTime() + MS) });

      const result = await service.sweep(NOW);

      expect(transitioned()).toEqual([['at-limit', 'FINISHED']]);
      expect(statusOf('before-limit')).toBe('CONFIRMED');
      expect(result.finished).toEqual({ changed: 1, skipped: 0, failed: 0 });
    });

    it('un milisegundo antes del fin, todavía no la finaliza', async () => {
      row('b1', 'CONFIRMED', { endAt: NOW });

      await service.sweep(new Date(NOW.getTime() - MS));

      expect(state.transition).not.toHaveBeenCalled();
    });

    it('la cambia como sistema: sin actor y con el motivo', async () => {
      row('b1', 'CONFIRMED', { endAt: new Date(NOW.getTime() - HOUR) });

      await service.sweep(NOW);

      expect(state.transition).toHaveBeenCalledWith('b1', 'FINISHED', { actorId: null, reason: FINISHED_REASON }, undefined);
    });
  });

  describe('sweep: PENDING → EXPIRED', () => {
    it('expira la que vence justo ahora y no la que vence un milisegundo después', async () => {
      row('at-limit', 'PENDING', { expiresAt: NOW });
      row('before-limit', 'PENDING', { expiresAt: new Date(NOW.getTime() + MS) });

      const result = await service.sweep(NOW);

      expect(transitioned()).toEqual([['at-limit', 'EXPIRED']]);
      expect(statusOf('before-limit')).toBe('PENDING');
      expect(result.expired).toEqual({ changed: 1, skipped: 0, failed: 0 });
    });

    it('un milisegundo antes del plazo, todavía no la expira', async () => {
      row('b1', 'PENDING', { expiresAt: NOW });

      await service.sweep(new Date(NOW.getTime() - MS));

      expect(state.transition).not.toHaveBeenCalled();
    });

    it('la cambia como sistema: sin actor y con el motivo', async () => {
      row('b1', 'PENDING', { expiresAt: new Date(NOW.getTime() - HOUR) });

      await service.sweep(NOW);

      expect(state.transition).toHaveBeenCalledWith('b1', 'EXPIRED', { actorId: null, reason: EXPIRED_REASON }, undefined);
    });

    it('no toca una pendiente sin plazo (expiresAt nulo), aunque su horario ya pasó', async () => {
      row('b1', 'PENDING', { expiresAt: null, endAt: new Date(NOW.getTime() - HOUR) });

      await service.sweep(NOW);

      expect(state.transition).not.toHaveBeenCalled();
    });
  });

  it.each(['PAID', 'FINISHED', 'CANCELLED', 'EXPIRED'] as const)(
    'no toca una reserva %s aunque su horario y su plazo ya pasaron',
    async (status) => {
      const past = new Date(NOW.getTime() - HOUR);
      row('b1', status, { endAt: past, expiresAt: past });

      const result = await service.sweep(NOW);

      expect(state.transition).not.toHaveBeenCalled();
      expect(result).toEqual({
        finished: { changed: 0, skipped: 0, failed: 0 },
        expired: { changed: 0, skipped: 0, failed: 0 },
      });
    },
  );

  it('no finaliza una CONFIRMED por su expiresAt ni expira una PENDING por su endAt', async () => {
    const past = new Date(NOW.getTime() - HOUR);
    row('confirmed', 'CONFIRMED', { expiresAt: past });
    row('pending', 'PENDING', { endAt: past, expiresAt: new Date(NOW.getTime() + HOUR) });

    await service.sweep(NOW);

    expect(state.transition).not.toHaveBeenCalled();
  });

  describe('un lote donde algunas fallan', () => {
    it('salta la que otro cambio ganó, registra la que falló y sigue con las demás', async () => {
      const past = new Date(NOW.getTime() - HOUR);
      ['b1', 'b2', 'b3', 'b4'].forEach((id) => row(id, 'CONFIRMED', { endAt: past }));
      const pass = state.transition.getMockImplementation()!;
      state.transition.mockImplementation((id: string, to: BookingStatus) => {
        // b2: el arrendatario la canceló entre la búsqueda y el cambio. b3: se cayó la conexión.
        if (id === 'b2') return Promise.reject(new ConflictException('La reserva cambió de estado'));
        if (id === 'b3') return Promise.reject(new Error('se cayó la conexión'));
        return pass(id, to);
      });

      const result = await service.sweep(NOW);

      expect(transitioned().map(([id]) => id)).toEqual(['b1', 'b2', 'b3', 'b4']);
      expect(result.finished).toEqual({ changed: 2, skipped: 1, failed: 1 });
      expect(statusOf('b4')).toBe('FINISHED');
      expect(errorLog).toHaveBeenCalledTimes(1);
    });

    it('una pendiente que el webhook pagó entre la búsqueda y el cambio se salta', async () => {
      row('paid-meanwhile', 'PENDING', { expiresAt: NOW });
      row('b2', 'PENDING', { expiresAt: NOW });
      const pass = state.transition.getMockImplementation()!;
      state.transition.mockImplementation((id: string, to: BookingStatus) => {
        if (id === 'paid-meanwhile') {
          rows.find((r) => r.id === id)!.status = 'PAID';
          return Promise.reject(new ConflictException('Una reserva en estado PAID no puede pasar a EXPIRED'));
        }
        return pass(id, to);
      });

      const result = await service.sweep(NOW);

      expect(result.expired).toEqual({ changed: 1, skipped: 1, failed: 0 });
      expect(statusOf('paid-meanwhile')).toBe('PAID');
      expect(statusOf('b2')).toBe('EXPIRED');
      expect(errorLog).not.toHaveBeenCalled();
    });

    it('una reserva que ya no existe (404) también se salta', async () => {
      row('b1', 'PENDING', { expiresAt: NOW });
      state.transition.mockRejectedValue(new NotFoundException('La reserva no existe'));

      const result = await service.sweep(NOW);

      expect(result.expired).toEqual({ changed: 0, skipped: 1, failed: 0 });
    });
  });

  describe('por lotes', () => {
    it('lee de a batchSize hasta agotar las vencidas', async () => {
      ['b1', 'b2', 'b3', 'b4', 'b5'].forEach((id) => row(id, 'CONFIRMED', { endAt: NOW }));

      const result = await service.sweep(NOW, 2);

      expect(result.finished.changed).toBe(5);
      // CONFIRMED: 2 + 2 + 1. PENDING: una consulta vacía.
      expect(prisma.booking.findMany).toHaveBeenCalledTimes(4);
    });

    it('termina aunque todas fallen: no vuelve a leer las que quedaron atrás', async () => {
      ['b1', 'b2', 'b3', 'b4', 'b5'].forEach((id) => row(id, 'CONFIRMED', { endAt: NOW }));
      state.transition.mockRejectedValue(new Error('base caída'));

      const result = await service.sweep(NOW, 2);

      expect(result.finished).toEqual({ changed: 0, skipped: 0, failed: 5 });
      expect(state.transition).toHaveBeenCalledTimes(5);
    });
  });

  it('correrlo dos veces no cambia nada la segunda', async () => {
    row('b1', 'CONFIRMED', { endAt: NOW });
    row('b2', 'PENDING', { expiresAt: NOW });
    await service.sweep(NOW);
    state.transition.mockClear();

    const again = await service.sweep(NOW);

    expect(state.transition).not.toHaveBeenCalled();
    expect(again.finished.changed + again.expired.changed).toBe(0);
  });

  describe('expireStalePending (para RE-02)', () => {
    // Un cliente de transacción con sus propios mocks: el servicio no debe usar el cliente normal.
    const tx = { booking: { findMany: fakeFindMany() } };

    /** Leyó solo con `tx`, nunca con `prisma`, y cada cambio de estado recibió ese mismo `tx`. */
    const expectOnlyTx = () => {
      expect(tx.booking.findMany).toHaveBeenCalled();
      expect(prisma.booking.findMany).not.toHaveBeenCalled();
      for (const call of state.transition.mock.calls) {
        expect(call[3]).toBe(tx);
      }
    };

    it('expira dentro de la transacción de quien llama, solo en el espacio pedido', async () => {
      row('mine', 'PENDING', { spaceId: 's1', expiresAt: NOW });
      row('fresh', 'PENDING', { spaceId: 's1', expiresAt: new Date(NOW.getTime() + MS) });
      row('other-space', 'PENDING', { spaceId: 's2', expiresAt: NOW });

      const result = await service.expireStalePending(tx as never, NOW, 's1');

      expect(result).toEqual({ changed: 1, skipped: 0, failed: 0 });
      expect(state.transition).toHaveBeenCalledWith('mine', 'EXPIRED', { actorId: null, reason: EXPIRED_REASON }, tx);
      expect(tx.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'PENDING', expiresAt: { lte: NOW }, spaceId: 's1' } }),
      );
      expectOnlyTx();
      expect(statusOf('fresh')).toBe('PENDING');
      expect(statusOf('other-space')).toBe('PENDING');
    });

    it('sin spaceId expira las de todos los espacios', async () => {
      row('a', 'PENDING', { spaceId: 's1', expiresAt: NOW });
      row('b', 'PENDING', { spaceId: 's2', expiresAt: NOW });

      const result = await service.expireStalePending(tx as never, NOW);

      expect(result.changed).toBe(2);
      expect(state.transition).toHaveBeenCalledTimes(2);
      expectOnlyTx();
    });

    it('salta la que otro cambio ganó y sigue con las demás', async () => {
      row('a', 'PENDING', { expiresAt: NOW });
      row('b', 'PENDING', { expiresAt: NOW });
      const pass = state.transition.getMockImplementation()!;
      state.transition.mockImplementation((id: string, to: BookingStatus, change: unknown, client: unknown) =>
        id === 'a' ? Promise.reject(new ConflictException('ya está PAID')) : pass(id, to, change, client),
      );

      const result = await service.expireStalePending(tx as never, NOW);

      expect(result).toEqual({ changed: 1, skipped: 1, failed: 0 });
      expectOnlyTx();
    });

    it('un error inesperado se propaga, porque la transacción de quien llama ya no sirve', async () => {
      row('a', 'PENDING', { expiresAt: NOW });
      state.transition.mockRejectedValue(new Error('deadlock'));

      await expect(service.expireStalePending(tx as never, NOW)).rejects.toThrow('deadlock');
    });
  });
});
