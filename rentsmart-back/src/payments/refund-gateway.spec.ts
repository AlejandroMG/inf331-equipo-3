import { Logger } from '@nestjs/common';
import type Stripe from 'stripe';
import {
  ALREADY_REFUNDED_CODE,
  NoopRefundGateway,
  StripeRefundGateway,
  type RefundRequest,
  type StripeRefundClient,
} from './refund-gateway';
import { chooseRefundGateway } from './refunds.module';

// Ningún test llama a Stripe: `refunds.create` es un doble.
const REQUEST: RefundRequest = { paymentId: 'p1', paymentIntentId: 'pi_1', amount: 26400, alreadyRefunded: 0 };

describe('StripeRefundGateway (PA-03)', () => {
  const create = jest.fn();
  const gateway = new StripeRefundGateway({ refunds: { create } } as unknown as StripeRefundClient);
  let logError: jest.SpyInstance;

  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({ id: 're_1', status: 'succeeded' });
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => logError.mockRestore());

  const keys = () => create.mock.calls.map(([, options]) => (options as { idempotencyKey: string }).idempotencyKey);

  it('pide el reembolso con el monto en CLP tal cual (sin × 100) y una clave de idempotencia derivada del pago', async () => {
    await gateway.refund(REQUEST);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      { payment_intent: 'pi_1', amount: 26400 },
      { idempotencyKey: 'refund-p1-0-26400' },
    );
  });

  it.each(['succeeded', 'pending'])('un reembolso en estado %s cuenta como aceptado', async (status) => {
    create.mockResolvedValue({ id: 're_1', status });

    await expect(gateway.refund(REQUEST)).resolves.toBeUndefined();
    expect(logError).not.toHaveBeenCalled();
  });

  it.each(['failed', 'canceled', 'requires_action', null])(
    'un reembolso en estado %s lanza un error, con el id y el estado en el log',
    async (status) => {
      create.mockResolvedValue({ id: 're_1', status });

      await expect(gateway.refund(REQUEST)).rejects.toThrow(String(status));

      const logged = logError.mock.calls.flat().join(' ');
      expect(logged).toContain('Stripe no reembolsó');
      expect(logged).toContain('p1');
      expect(logged).toContain('re_1');
    },
  );

  it('dos llamadas con el mismo estado del pago mandan la misma clave de idempotencia', async () => {
    await gateway.refund(REQUEST);
    await gateway.refund(REQUEST);

    expect(keys()[0]).toBe(keys()[1]);
  });

  it('un segundo reembolso parcial usa otra clave: si no, Stripe repetiría la respuesta del primero sin devolver nada', async () => {
    await gateway.refund({ ...REQUEST, amount: 1000 });
    await gateway.refund({ ...REQUEST, amount: 1000, alreadyRefunded: 1000 });

    expect(keys()[0]).not.toBe(keys()[1]);
  });

  it('un error de Stripe se propaga tal cual y el log trae los ids, no el mensaje', async () => {
    const failure = Object.assign(new Error('clave sk_test_secreta inválida'), {
      type: 'StripeAuthenticationError',
      statusCode: 401,
      requestId: 'req_1',
    });
    create.mockRejectedValue(failure);

    await expect(gateway.refund(REQUEST)).rejects.toBe(failure);

    const logged = logError.mock.calls.flat().join(' ');
    expect(logged).toContain('Stripe no reembolsó');
    expect(logged).toContain('p1');
    expect(logged).toContain('req_1');
    expect(logged).not.toContain('sk_test_secreta');
  });

  it(`${ALREADY_REFUNDED_CODE} cuenta como éxito: el dinero ya se devolvió`, async () => {
    create.mockRejectedValue(Object.assign(new Error('ya reembolsado'), { code: ALREADY_REFUNDED_CODE }));

    await expect(gateway.refund(REQUEST)).resolves.toBeUndefined();
    expect(logError).not.toHaveBeenCalled();
  });
});

describe('NoopRefundGateway (PA-03)', () => {
  it('rechaza el reembolso: sin Stripe no se devolvió nada, así que el pago no puede quedar REFUNDED', async () => {
    await expect(new NoopRefundGateway().refund(REQUEST)).rejects.toThrow('p1');
  });
});

describe('chooseRefundGateway', () => {
  it('sin cliente de Stripe usa el que no llama a nadie', () => {
    expect(chooseRefundGateway(null)).toBeInstanceOf(NoopRefundGateway);
  });

  it('con cliente usa Stripe', () => {
    expect(chooseRefundGateway({ refunds: { create: jest.fn() } } as unknown as Stripe)).toBeInstanceOf(StripeRefundGateway);
  });
});
