import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentRefundService, RefundNotRecordedError } from './payment-refund.service';
import { RefundGateway } from './refund-gateway';

const REASON = 'Cancelación de la reserva';
const SUCCEEDED = {
  id: 'p1',
  status: 'SUCCEEDED',
  amount: 26400,
  refundedAmount: 0,
  stripePaymentIntentId: 'pi_1',
};

describe('PaymentRefundService (PA-03)', () => {
  const prisma = { payment: { findUnique: jest.fn(), updateMany: jest.fn() }, $transaction: jest.fn() };
  const gateway = { refund: jest.fn() };
  const service = new PaymentRefundService(prisma as unknown as PrismaService, gateway as RefundGateway);
  let spies: jest.SpyInstance[];

  beforeEach(() => {
    jest.resetAllMocks();
    gateway.refund.mockResolvedValue(undefined);
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    spies = [
      jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
    ];
  });

  afterEach(() => spies.forEach((spy) => spy.mockRestore()));

  const expectNothingHappened = () => {
    expect(gateway.refund).not.toHaveBeenCalled();
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  };

  it('sin pago no hace nada', async () => {
    prisma.payment.findUnique.mockResolvedValue(null);

    await expect(service.refundBooking('b1', 26400, REASON)).resolves.toBeUndefined();

    expect(prisma.payment.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { bookingId: 'b1' } }));
    expectNothingHappened();
  });

  it('un pago ya reembolsado no hace nada (idempotente)', async () => {
    prisma.payment.findUnique.mockResolvedValue({ ...SUCCEEDED, status: 'REFUNDED', refundedAmount: 26400 });

    await expect(service.refundBooking('b1', 26400, REASON)).resolves.toBeUndefined();

    expectNothingHappened();
  });

  it.each([0, -1])('un monto de %d no hace nada', async (amount) => {
    prisma.payment.findUnique.mockResolvedValue(SUCCEEDED);

    await expect(service.refundBooking('b1', amount, REASON)).resolves.toBeUndefined();

    expectNothingHappened();
  });

  it.each(['PENDING', 'FAILED'])('un pago %s lanza un error, sin llamar al proveedor', async (status) => {
    prisma.payment.findUnique.mockResolvedValue({ ...SUCCEEDED, status });

    await expect(service.refundBooking('b1', 26400, REASON)).rejects.toThrow(status);

    expectNothingHappened();
  });

  it('un pago sin PaymentIntent lanza un error, sin llamar al proveedor', async () => {
    prisma.payment.findUnique.mockResolvedValue({ ...SUCCEEDED, stripePaymentIntentId: null });

    await expect(service.refundBooking('b1', 26400, REASON)).rejects.toThrow('p1');

    expectNothingHappened();
  });

  it.each([
    ['supera el pago', 0, 26401],
    ['sumado a lo ya devuelto supera el pago', 26000, 401],
  ])('un monto que %s lanza un error, sin llamar al proveedor', async (_name, refundedAmount, amount) => {
    prisma.payment.findUnique.mockResolvedValue({ ...SUCCEEDED, refundedAmount });

    await expect(service.refundBooking('b1', amount, REASON)).rejects.toThrow('p1');

    expectNothingHappened();
  });

  it('reembolso total: pide al proveedor el monto y deja el pago REFUNDED con una actualización condicionada', async () => {
    prisma.payment.findUnique.mockResolvedValue(SUCCEEDED);

    await service.refundBooking('b1', 26400, REASON);

    expect(gateway.refund).toHaveBeenCalledWith({
      paymentId: 'p1',
      paymentIntentId: 'pi_1',
      amount: 26400,
      alreadyRefunded: 0,
    });
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', status: 'SUCCEEDED', refundedAmount: 0 },
      data: { refundedAmount: 26400, status: 'REFUNDED' },
    });
  });

  it('reembolso parcial: actualiza refundedAmount y el pago sigue SUCCEEDED', async () => {
    prisma.payment.findUnique.mockResolvedValue(SUCCEEDED);

    await service.refundBooking('b1', 10000, REASON);

    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', status: 'SUCCEEDED', refundedAmount: 0 },
      data: { refundedAmount: 10000, status: 'SUCCEEDED' },
    });
  });

  it('un parcial que completa el pago lo deja REFUNDED', async () => {
    prisma.payment.findUnique.mockResolvedValue({ ...SUCCEEDED, refundedAmount: 10000 });

    await service.refundBooking('b1', 16400, REASON);

    expect(gateway.refund).toHaveBeenCalledWith(expect.objectContaining({ amount: 16400, alreadyRefunded: 10000 }));
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', status: 'SUCCEEDED', refundedAmount: 10000 },
      data: { refundedAmount: 26400, status: 'REFUNDED' },
    });
  });

  it('si la actualización condicionada no encuentra la fila (0 filas), no reintenta la escritura ni falla', async () => {
    prisma.payment.findUnique.mockResolvedValue(SUCCEEDED);
    prisma.payment.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.refundBooking('b1', 26400, REASON)).resolves.toBeUndefined();

    expect(prisma.payment.updateMany).toHaveBeenCalledTimes(1);
  });

  it('si Stripe reembolsó y falla la base, lanza RefundNotRecordedError y el log dice cómo reparar, sin el mensaje del error', async () => {
    prisma.payment.findUnique.mockResolvedValue(SUCCEEDED);
    prisma.payment.updateMany.mockRejectedValue(new Error('postgresql://usuario:clave@base'));

    await expect(service.refundBooking('b1', 26400, REASON)).rejects.toBeInstanceOf(RefundNotRecordedError);

    expect(gateway.refund).toHaveBeenCalledTimes(1);
    const [logError] = spies.slice(-1);
    const logged = logError.mock.calls.flat().join(' ');
    expect(logged).toContain('Stripe reembolsó 26400 CLP');
    expect(logged).toContain('p1');
    expect(logged).toContain('b1');
    expect(logged).toContain('refundedAmount=26400');
    expect(logged).toContain('status=REFUNDED');
    expect(logged).not.toContain('usuario:clave');
  });

  it('si el proveedor falla, propaga el error y no toca el pago', async () => {
    prisma.payment.findUnique.mockResolvedValue(SUCCEEDED);
    const failure = new Error('Stripe no responde');
    gateway.refund.mockRejectedValue(failure);

    await expect(service.refundBooking('b1', 26400, REASON)).rejects.toBe(failure);

    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it('no abre una transacción alrededor de la llamada al proveedor', async () => {
    prisma.payment.findUnique.mockResolvedValue(SUCCEEDED);

    await service.refundBooking('b1', 26400, REASON);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
