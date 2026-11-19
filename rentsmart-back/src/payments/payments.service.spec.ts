import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { BookingConfirmationService } from '../bookings/booking-confirmation.service';
import { BookingStateService } from '../bookings/booking-state.service';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_REFUNDER } from './payment-refunder';
import { PaymentsService, PAID_REASON } from './payments.service';
import { STRIPE_CLIENT } from './stripe.module';

// Pagos con dobles de la base y de Stripe; contra la base de verdad y con firmas reales están en
// test/payments.e2e-spec.ts (Mis pagos) y test/payments-webhook.e2e-spec.ts (webhook).
describe('PaymentsService', () => {
  let service: PaymentsService;
  const prisma = {
    $transaction: jest.fn(),
    payment: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    bookingEvent: { count: jest.fn() },
  };
  const stripe = { webhooks: { constructEvent: jest.fn() } };
  const config = { get: jest.fn() };
  const state = { transition: jest.fn() };
  const confirmation = { confirm: jest.fn() };
  const refunder = { refundBooking: jest.fn() };

  const stored = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    bookingId: `b-${id}`,
    stripeSessionId: `cs_${id}`,
    stripePaymentIntentId: null,
    amount: 26400,
    fee: 2400,
    refundedAmount: 0,
    status: 'PENDING',
    createdAt: new Date('2030-10-13T15:07:00.000Z'),
    updatedAt: new Date('2030-10-13T15:07:00.000Z'),
    booking: { space: { name: 'Sala Alameda' } },
    ...extra,
  });

  const build = async (stripeClient: unknown = stripe) => {
    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: STRIPE_CLIENT, useValue: stripeClient },
        { provide: BookingStateService, useValue: state },
        { provide: BookingConfirmationService, useValue: confirmation },
        { provide: PAYMENT_REFUNDER, useValue: refunder },
      ],
    }).compile();
    service = module.get(PaymentsService);
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    config.get.mockReturnValue('whsec_secreto_falso');
    prisma.$transaction.mockImplementation((callback: (tx: typeof prisma) => unknown) => callback(prisma));
    await build();
  });

  describe('findMine', () => {
    it('trae una página de los pagos de mis reservas, los más recientes primero, con el nombre del espacio', async () => {
      prisma.payment.findMany.mockResolvedValue([stored('p2', { status: 'SUCCEEDED' }), stored('p1')]);
      prisma.payment.count.mockResolvedValue(12);

      const page = await service.findMine('renter', { page: 2, pageSize: 10 });

      const where = { booking: { renterId: 'renter' } };
      expect(prisma.payment.findMany).toHaveBeenCalledWith({
        where,
        include: { booking: { select: { space: { select: { name: true } } } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 10,
        take: 10,
      });
      expect(prisma.payment.count).toHaveBeenCalledWith({ where });
      expect(page).toEqual({
        items: [
          {
            id: 'p2',
            bookingId: 'b-p2',
            spaceName: 'Sala Alameda',
            amount: 26400,
            fee: 2400,
            refundedAmount: 0,
            status: 'SUCCEEDED',
            createdAt: new Date('2030-10-13T15:07:00.000Z'),
          },
          expect.objectContaining({ id: 'p1', status: 'PENDING' }),
        ],
        total: 12,
        page: 2,
        pageSize: 10,
      });
      // No expone los ids de Stripe: no están en el contrato de PaymentDto.
      expect(Object.keys(page.items[0]).sort()).toEqual([
        'amount', 'bookingId', 'createdAt', 'fee', 'id', 'refundedAmount', 'spaceName', 'status',
      ]);
    });

    it('sin pagos responde una página vacía', async () => {
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.payment.count.mockResolvedValue(0);

      await expect(service.findMine('renter', { page: 1, pageSize: 20 })).resolves.toEqual({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });
    });
  });

  describe('handleWebhook', () => {
    const BODY = Buffer.from('{"id":"evt_1"}');
    const SIGNATURE = 't=1,v1=firma-falsa';
    const SESSION_ID = 'cs_test_1';

    /** Hace que la firma sea válida y que el evento sea este. */
    const event = (type: string, object: Record<string, unknown> = {}) =>
      stripe.webhooks.constructEvent.mockReturnValue({ id: 'evt_1', type, data: { object: { id: SESSION_ID, ...object } } });
    const completed = (extra: Record<string, unknown> = {}) =>
      event('checkout.session.completed', { payment_status: 'paid', payment_intent: 'pi_test_1', ...extra });
    const payment = (bookingStatus: string, status = 'PENDING') => ({
      id: 'pay-1',
      bookingId: 'book-1',
      amount: 26400,
      status,
      booking: { status: bookingStatus },
    });
    const handle = () => service.handleWebhook(BODY, SIGNATURE);
    const noWrites = () => {
      expect(state.transition).not.toHaveBeenCalled();
      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
      expect(refunder.refundBooking).not.toHaveBeenCalled();
      expect(confirmation.confirm).not.toHaveBeenCalled();
    };

    let logged: { error: jest.SpyInstance; warn: jest.SpyInstance; log: jest.SpyInstance };
    beforeEach(() => {
      logged = {
        error: jest.spyOn(Logger.prototype, 'error').mockImplementation(),
        warn: jest.spyOn(Logger.prototype, 'warn').mockImplementation(),
        log: jest.spyOn(Logger.prototype, 'log').mockImplementation(),
      };
    });
    afterEach(() => jest.restoreAllMocks());

    /** Todo lo que quedó en el log, para revisar que no se filtre nada. */
    const allLogs = () =>
      JSON.stringify([...logged.error.mock.calls, ...logged.warn.mock.calls, ...logged.log.mock.calls]);

    describe('configuración y firma', () => {
      it.each([[''], [undefined]])('responde 503 sin el secreto del webhook (%j)', async (secret) => {
        config.get.mockReturnValue(secret);

        await expect(handle()).rejects.toThrow(ServiceUnavailableException);
        expect(stripe.webhooks.constructEvent).not.toHaveBeenCalled();
      });

      it('responde 503 sin cliente de Stripe', async () => {
        await build(null);

        await expect(handle()).rejects.toThrow(ServiceUnavailableException);
      });

      it('el 503 no da detalles de qué variable falta', async () => {
        config.get.mockReturnValue('');

        await expect(handle()).rejects.not.toThrow(/STRIPE|whsec|secret/i);
      });

      it('responde 400 sin el cuerpo sin interpretar', async () => {
        await expect(service.handleWebhook(undefined, SIGNATURE)).rejects.toThrow(BadRequestException);
        expect(stripe.webhooks.constructEvent).not.toHaveBeenCalled();
      });

      it('responde 400 con una firma inválida, sin registrar el cuerpo ni la firma', async () => {
        stripe.webhooks.constructEvent.mockImplementation(() => {
          throw new Error(`No signatures found matching ${SIGNATURE} for payload ${BODY.toString()}`);
        });

        await expect(handle()).rejects.toThrow(BadRequestException);
        expect(allLogs()).not.toContain('firma-falsa');
        expect(allLogs()).not.toContain('evt_1');
        expect(prisma.payment.findUnique).not.toHaveBeenCalled();
      });

      it('verifica la firma con el cuerpo tal como llegó, la firma y el secreto', async () => {
        event('customer.created');

        await handle();

        expect(config.get).toHaveBeenCalledWith('STRIPE_WEBHOOK_SECRET');
        expect(stripe.webhooks.constructEvent).toHaveBeenCalledWith(BODY, SIGNATURE, 'whsec_secreto_falso');
      });

      it('un tipo de evento que no interesa responde 200 sin hacer nada', async () => {
        event('customer.created');

        await expect(handle()).resolves.toEqual({ received: true });
        expect(prisma.payment.findUnique).not.toHaveBeenCalled();
        noWrites();
      });
    });

    describe('checkout.session.completed', () => {
      it('busca el pago por la sesión, no por los metadatos', async () => {
        completed({ metadata: { bookingId: 'otra-reserva' }, client_reference_id: 'otra-reserva' });
        prisma.payment.findUnique.mockResolvedValue(payment('PENDING'));

        await handle();

        expect(prisma.payment.findUnique).toHaveBeenCalledWith(
          expect.objectContaining({ where: { stripeSessionId: SESSION_ID } }),
        );
        expect(state.transition).toHaveBeenCalledWith('book-1', 'PAID', expect.anything(), expect.anything());
      });

      it('con payment_status distinto de paid responde 200 sin hacer nada y deja un error con los ids', async () => {
        completed({ payment_status: 'unpaid', client_reference_id: 'book-1' });

        await expect(handle()).resolves.toEqual({ received: true });
        noWrites();
        const [message] = logged.error.mock.calls[0] as [string];
        expect(message).toContain(SESSION_ID);
        expect(message).toContain('book-1');
        expect(message).toContain('pi_test_1');
      });

      it('con una sesión desconocida responde 200 y deja el error con el id, para reembolsarla a mano', async () => {
        completed();
        prisma.payment.findUnique.mockResolvedValue(null);

        await expect(handle()).resolves.toEqual({ received: true });
        noWrites();
        expect(logged.error).toHaveBeenCalledWith(expect.stringContaining(SESSION_ID));
      });

      it('una PENDING pasa a PAID con actor nulo y el pago a SUCCEEDED en una transacción, y después se confirma', async () => {
        completed();
        prisma.payment.findUnique.mockResolvedValue(payment('PENDING'));

        await expect(handle()).resolves.toEqual({ received: true });

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(state.transition).toHaveBeenCalledWith('book-1', 'PAID', { actorId: null, reason: PAID_REASON }, prisma);
        expect(prisma.payment.update).toHaveBeenCalledWith({
          where: { id: 'pay-1' },
          data: { status: 'SUCCEEDED', stripePaymentIntentId: 'pi_test_1' },
        });
        expect(confirmation.confirm).toHaveBeenCalledWith('book-1');
        const transactionOrder = prisma.$transaction.mock.invocationCallOrder[0];
        expect(confirmation.confirm.mock.invocationCallOrder[0]).toBeGreaterThan(transactionOrder);
        expect(refunder.refundBooking).not.toHaveBeenCalled();
      });

      it('acepta el PaymentIntent expandido como objeto', async () => {
        completed({ payment_intent: { id: 'pi_expandido' } });
        prisma.payment.findUnique.mockResolvedValue(payment('PENDING'));

        await handle();

        expect(prisma.payment.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ stripePaymentIntentId: 'pi_expandido' }) }),
        );
      });

      it('si la confirmación falla igual responde 200 y lo registra: el pago ya quedó guardado', async () => {
        completed();
        prisma.payment.findUnique.mockResolvedValue(payment('PENDING'));
        confirmation.confirm.mockRejectedValue(new Error('falló la validación'));

        await expect(handle()).resolves.toEqual({ received: true });
        expect(logged.error).toHaveBeenCalledWith(expect.stringContaining('book-1'));
      });

      it('si falla la transacción no confirma y deja que Stripe reintente', async () => {
        completed();
        prisma.payment.findUnique.mockResolvedValue(payment('PENDING'));
        prisma.payment.update.mockRejectedValue(new Error('la base no responde'));

        await expect(handle()).rejects.toThrow('la base no responde');
        expect(confirmation.confirm).not.toHaveBeenCalled();
      });

      it.each(['EXPIRED', 'CANCELLED'])('sobre una %s registra el pago y pide el reembolso del total', async (status) => {
        completed();
        prisma.payment.findUnique.mockResolvedValue(payment(status));

        await expect(handle()).resolves.toEqual({ received: true });

        expect(state.transition).not.toHaveBeenCalled();
        expect(prisma.payment.updateMany).toHaveBeenCalledWith({
          where: { id: 'pay-1', status: { in: ['PENDING', 'FAILED'] } },
          data: { status: 'SUCCEEDED', stripePaymentIntentId: 'pi_test_1' },
        });
        expect(refunder.refundBooking).toHaveBeenCalledWith('book-1', 26400, expect.stringContaining(status));
        expect(confirmation.confirm).not.toHaveBeenCalled();
      });

      it('un pago marcado FAILED que igual se cobró también se registra y se reembolsa', async () => {
        completed();
        prisma.payment.findUnique.mockResolvedValue(payment('EXPIRED', 'FAILED'));

        await handle();

        expect(prisma.payment.updateMany).toHaveBeenCalled();
        expect(refunder.refundBooking).toHaveBeenCalledWith('book-1', 26400, expect.any(String));
      });

      it('si el reembolso falla, el error llega a la respuesta para que Stripe reintente', async () => {
        completed();
        prisma.payment.findUnique.mockResolvedValue(payment('EXPIRED'));
        refunder.refundBooking.mockRejectedValue(new Error('detalle del proveedor'));

        await expect(handle()).rejects.toThrow(InternalServerErrorException);
        await expect(handle()).rejects.not.toThrow('detalle del proveedor');
        expect(logged.error).toHaveBeenCalledWith(expect.stringContaining('book-1'));
        expect(allLogs()).not.toContain('detalle del proveedor');
      });

      it('en el reintento (EXPIRED con pago SUCCEEDED) vuelve a pedir el reembolso sin reescribir el pago', async () => {
        completed();
        prisma.payment.findUnique.mockResolvedValue(payment('EXPIRED', 'SUCCEEDED'));
        prisma.bookingEvent.count.mockResolvedValue(0);

        await handle();

        expect(prisma.payment.updateMany).not.toHaveBeenCalled();
        expect(refunder.refundBooking).toHaveBeenCalledTimes(1);
      });

      it('con el pago ya REFUNDED responde 200 sin hacer nada', async () => {
        completed();
        prisma.payment.findUnique.mockResolvedValue(payment('CANCELLED', 'REFUNDED'));

        await expect(handle()).resolves.toEqual({ received: true });
        noWrites();
      });

      it('una reserva pagada y cancelada después no se reembolsa aquí: eso lo decidió la política de cancelación', async () => {
        completed();
        prisma.payment.findUnique.mockResolvedValue(payment('CANCELLED', 'SUCCEEDED'));
        prisma.bookingEvent.count.mockResolvedValue(1);

        await expect(handle()).resolves.toEqual({ received: true });

        expect(prisma.bookingEvent.count).toHaveBeenCalledWith({ where: { bookingId: 'book-1', toStatus: 'PAID' } });
        noWrites();
        expect(logged.warn).toHaveBeenCalledWith(expect.stringContaining('book-1'));
      });

      it.each(['CONFIRMED', 'FINISHED'])('sobre una %s responde 200 sin hacer nada', async (status) => {
        completed();
        prisma.payment.findUnique.mockResolvedValue(payment(status, 'SUCCEEDED'));

        await expect(handle()).resolves.toEqual({ received: true });
        noWrites();
      });

      it('sobre una PAID vuelve a confirmar, sin escribir nada: un reenvío repara una caída antes de confirm', async () => {
        completed();
        prisma.payment.findUnique.mockResolvedValue(payment('PAID', 'SUCCEEDED'));

        await expect(handle()).resolves.toEqual({ received: true });

        expect(confirmation.confirm).toHaveBeenCalledTimes(1);
        expect(confirmation.confirm).toHaveBeenCalledWith('book-1');
        expect(state.transition).not.toHaveBeenCalled();
        expect(prisma.payment.update).not.toHaveBeenCalled();
        expect(refunder.refundBooking).not.toHaveBeenCalled();
      });

      it('sobre una PAID, si confirm vuelve a fallar responde 200 y lo registra', async () => {
        completed();
        prisma.payment.findUnique.mockResolvedValue(payment('PAID', 'SUCCEEDED'));
        confirmation.confirm.mockRejectedValue(new Error('falló la validación'));

        await expect(handle()).resolves.toEqual({ received: true });
        expect(logged.error).toHaveBeenCalledWith(expect.stringContaining('book-1'));
      });

      describe('carreras (409 de transition)', () => {
        const losesRaceTo = (status: string, paymentStatus = 'PENDING') => {
          completed();
          prisma.payment.findUnique
            .mockResolvedValueOnce(payment('PENDING'))
            .mockResolvedValueOnce(payment(status, paymentStatus));
          state.transition.mockRejectedValue(new ConflictException('La reserva cambió de estado'));
        };

        it.each(['EXPIRED', 'CANCELLED'])('si ganó el paso a %s, vuelve a leer y reembolsa', async (status) => {
          losesRaceTo(status);

          await expect(handle()).resolves.toEqual({ received: true });

          expect(prisma.payment.findUnique).toHaveBeenCalledTimes(2);
          expect(refunder.refundBooking).toHaveBeenCalledWith('book-1', 26400, expect.stringContaining(status));
          expect(confirmation.confirm).not.toHaveBeenCalled();
        });

        it('si ganó otra entrega del mismo evento (PAID), no reembolsa y confirma (confirm debe ser idempotente)', async () => {
          losesRaceTo('PAID', 'SUCCEEDED');

          await expect(handle()).resolves.toEqual({ received: true });

          expect(refunder.refundBooking).not.toHaveBeenCalled();
          expect(confirmation.confirm).toHaveBeenCalledTimes(1);
        });

        it('si la reserva sigue PENDING después del 409, responde error para que Stripe reintente', async () => {
          losesRaceTo('PENDING');

          await expect(handle()).rejects.toThrow(ConflictException);
          expect(refunder.refundBooking).not.toHaveBeenCalled();
        });
      });
    });

    describe('checkout.session.expired', () => {
      it('con una sesión desconocida responde 200', async () => {
        event('checkout.session.expired');
        prisma.payment.findUnique.mockResolvedValue(null);

        await expect(handle()).resolves.toEqual({ received: true });
        noWrites();
      });

      it('una PENDING pasa a EXPIRED con actor nulo y el pago a FAILED, en una transacción', async () => {
        event('checkout.session.expired');
        prisma.payment.findUnique.mockResolvedValue(payment('PENDING'));

        await expect(handle()).resolves.toEqual({ received: true });

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(prisma.payment.updateMany).toHaveBeenCalledWith({
          where: { id: 'pay-1', status: 'PENDING' },
          data: { status: 'FAILED' },
        });
        expect(state.transition).toHaveBeenCalledWith(
          'book-1',
          'EXPIRED',
          expect.objectContaining({ actorId: null }),
          prisma,
        );
      });

      it.each(['PAID', 'CONFIRMED', 'FINISHED', 'CANCELLED', 'EXPIRED'])('no toca una reserva %s', async (status) => {
        event('checkout.session.expired');
        prisma.payment.findUnique.mockResolvedValue(payment(status, 'SUCCEEDED'));

        await expect(handle()).resolves.toEqual({ received: true });

        expect(state.transition).not.toHaveBeenCalled();
      });

      it('si otro cambio ganó (409), igual responde 200 y deja el pago en FAILED', async () => {
        event('checkout.session.expired');
        prisma.payment.findUnique.mockResolvedValue(payment('PENDING'));
        state.transition.mockRejectedValue(new ConflictException('La reserva cambió de estado'));

        await expect(handle()).resolves.toEqual({ received: true });

        expect(prisma.payment.updateMany).toHaveBeenCalled();
      });
    });
  });
});
