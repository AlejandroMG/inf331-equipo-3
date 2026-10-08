import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BookingStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStateService } from './booking-state.service';
import { canTransition } from './booking-transitions';

const STATUSES = Object.values(BookingStatus);
const PAIRS = STATUSES.flatMap((from) => STATUSES.map((to) => [from, to] as const));

describe('BookingStateService', () => {
  let service: BookingStateService;
  // El mismo objeto hace de cliente y de cliente de transacción.
  const prisma = {
    $transaction: jest.fn(),
    booking: { findUnique: jest.fn(), updateManyAndReturn: jest.fn() },
    bookingEvent: { create: jest.fn() },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((run: (tx: typeof prisma) => unknown) => run(prisma));
    const module = await Test.createTestingModule({
      providers: [BookingStateService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(BookingStateService);
  });

  describe('transition', () => {
    it.each(PAIRS)('%s → %s', async (from, to) => {
      prisma.booking.findUnique.mockResolvedValue({ status: from });
      prisma.booking.updateManyAndReturn.mockResolvedValue([{ id: 'b1', status: to }]);
      const result = service.transition('b1', to, { actorId: 'u1', reason: 'motivo' });

      if (canTransition(from, to)) {
        await expect(result).resolves.toEqual({ id: 'b1', status: to });
        expect(prisma.booking.updateManyAndReturn).toHaveBeenCalledWith({
          where: { id: 'b1', status: from },
          data: { status: to },
        });
        expect(prisma.bookingEvent.create).toHaveBeenCalledWith({
          data: { bookingId: 'b1', fromStatus: from, toStatus: to, actorId: 'u1', reason: 'motivo' },
        });
      } else {
        await expect(result).rejects.toBeInstanceOf(ConflictException);
        expect(prisma.booking.updateManyAndReturn).not.toHaveBeenCalled();
        expect(prisma.bookingEvent.create).not.toHaveBeenCalled();
      }
    });

    it('responde 404 si la reserva no existe', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);

      await expect(service.transition('no-existe', 'PAID', { actorId: null })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.bookingEvent.create).not.toHaveBeenCalled();
    });

    it('responde 409 y no escribe el evento si otro cambio actualizó la reserva primero', async () => {
      prisma.booking.findUnique.mockResolvedValue({ status: 'PENDING' });
      prisma.booking.updateManyAndReturn.mockResolvedValue([]);

      await expect(service.transition('b1', 'PAID', { actorId: null })).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.bookingEvent.create).not.toHaveBeenCalled();
    });

    it('sin actor ni motivo guarda nulos (cambio del sistema)', async () => {
      prisma.booking.findUnique.mockResolvedValue({ status: 'PENDING' });
      prisma.booking.updateManyAndReturn.mockResolvedValue([{ id: 'b1', status: 'EXPIRED' }]);

      await service.transition('b1', 'EXPIRED', { actorId: null });

      expect(prisma.bookingEvent.create).toHaveBeenCalledWith({
        data: { bookingId: 'b1', fromStatus: 'PENDING', toStatus: 'EXPIRED', actorId: null, reason: null },
      });
    });

    it('abre su propia transacción si no recibe una', async () => {
      prisma.booking.findUnique.mockResolvedValue({ status: 'PENDING' });
      prisma.booking.updateManyAndReturn.mockResolvedValue([{ id: 'b1', status: 'PAID' }]);

      await service.transition('b1', 'PAID', { actorId: null });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('usa la transacción de quien llama, sin abrir otra', async () => {
      const tx = {
        booking: {
          findUnique: jest.fn().mockResolvedValue({ status: 'PAID' }),
          updateManyAndReturn: jest.fn().mockResolvedValue([{ id: 'b1', status: 'CONFIRMED' }]),
        },
        bookingEvent: { create: jest.fn() },
      };

      await service.transition('b1', 'CONFIRMED', { actorId: null }, tx as never);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.booking.findUnique).not.toHaveBeenCalled();
      expect(tx.bookingEvent.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('recordCreation', () => {
    it('escribe el evento inicial, de nulo a PENDING', async () => {
      await service.recordCreation('b1', { actorId: 'u1' });

      expect(prisma.bookingEvent.create).toHaveBeenCalledWith({
        data: { bookingId: 'b1', fromStatus: null, toStatus: 'PENDING', actorId: 'u1', reason: null },
      });
    });

    it('usa la transacción de quien llama', async () => {
      const tx = { bookingEvent: { create: jest.fn() } };

      await service.recordCreation('b1', { actorId: 'u1', reason: 'reserva creada' }, tx as never);

      expect(prisma.bookingEvent.create).not.toHaveBeenCalled();
      expect(tx.bookingEvent.create).toHaveBeenCalledWith({
        data: { bookingId: 'b1', fromStatus: null, toStatus: 'PENDING', actorId: 'u1', reason: 'reserva creada' },
      });
    });
  });
});
