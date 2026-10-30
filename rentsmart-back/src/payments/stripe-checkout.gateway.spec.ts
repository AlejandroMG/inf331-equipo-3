import { BadGatewayException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  describeStripeError,
  STRIPE_UNAVAILABLE_MESSAGE,
  StripeCheckoutGateway,
  type StripeCheckoutClient,
} from './stripe-checkout.gateway';

// Ningún test llama a Stripe: `checkout.sessions.create` es un doble.
const BOOKING = {
  id: 'b1',
  spaceName: 'Sala Alameda',
  subtotal: 24000,
  fee: 2400,
  total: 26400,
  // 31 minutos después de las 15:07:00.500 UTC: los milisegundos se descartan al pasar a segundos.
  expiresAt: new Date('2030-10-13T15:38:00.500Z'),
};

describe('StripeCheckoutGateway (PA-01)', () => {
  const create = jest.fn();
  const expire = jest.fn();
  const stripe = { checkout: { sessions: { create, expire } } } as unknown as StripeCheckoutClient;
  let logError: jest.SpyInstance;
  let logWarn: jest.SpyInstance;
  const gateway = (frontendUrl?: string) =>
    new StripeCheckoutGateway(stripe, { get: () => frontendUrl } as unknown as ConfigService);

  beforeEach(() => {
    create.mockReset();
    expire.mockReset();
    create.mockResolvedValue({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' });
    expire.mockResolvedValue({ id: 'cs_test_1', status: 'expired' });
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    logWarn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logError.mockRestore();
    logWarn.mockRestore();
  });

  it('crea la sesión en CLP por el total, sin multiplicar por 100, con el id de la reserva y las dos URLs', async () => {
    await gateway('https://rentsmart.test/').createSession(BOOKING);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      mode: 'payment',
      currency: 'clp',
      line_items: [
        {
          quantity: 1,
          price_data: { currency: 'clp', unit_amount: 26400, product_data: { name: 'Reserva en Sala Alameda' } },
        },
      ],
      metadata: { bookingId: 'b1' },
      client_reference_id: 'b1',
      expires_at: Math.floor(Date.parse('2030-10-13T15:38:00.000Z') / 1000),
      success_url: 'https://rentsmart.test/bookings/b1?pago=ok',
      cancel_url: 'https://rentsmart.test/bookings/b1?pago=cancelado',
    });
  });

  it('expires_at va en segundos enteros y vence junto con la retención', async () => {
    await gateway().createSession(BOOKING);

    const [params] = create.mock.calls[0] as [{ expires_at: number }];
    expect(Number.isInteger(params.expires_at)).toBe(true);
    expect(params.expires_at).toBe(1_918_136_280);
    expect(new Date(params.expires_at * 1000).toISOString()).toBe('2030-10-13T15:38:00.000Z');
  });

  it('sin FRONTEND_URL vuelve al front de Vite en local', async () => {
    await gateway().createSession(BOOKING);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: 'http://localhost:5173/bookings/b1?pago=ok',
        cancel_url: 'http://localhost:5173/bookings/b1?pago=cancelado',
      }),
    );
  });

  it('devuelve la URL de pago y el id de la sesión', async () => {
    await expect(gateway().createSession(BOOKING)).resolves.toEqual({
      url: 'https://checkout.stripe.com/c/pay/cs_test_1',
      sessionId: 'cs_test_1',
    });
  });

  it('si Stripe no entrega la URL responde 502 e intenta expirar esa sesión', async () => {
    create.mockResolvedValue({ id: 'cs_test_1', url: null });

    const error = await gateway().createSession(BOOKING).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadGatewayException);
    expect((error as Error).message).toBe(STRIPE_UNAVAILABLE_MESSAGE);
    expect(expire).toHaveBeenCalledWith('cs_test_1');
  });

  it('un error de Stripe responde 502 con un mensaje claro y deja el detalle técnico en el log, sin el mensaje', async () => {
    // Como un StripeAuthenticationError: su mensaje puede traer parte de la clave.
    const stripeError = Object.assign(new Error('Invalid API Key provided: sk_test_****fake'), {
      type: 'StripeAuthenticationError',
      code: 'api_key_invalid',
      statusCode: 401,
      requestId: 'req_123',
    });
    create.mockRejectedValue(stripeError);

    const error = await gateway().createSession(BOOKING).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadGatewayException);
    expect((error as Error).message).toBe('No pudimos iniciar el pago con Stripe; intenta de nuevo');
    expect(logError).toHaveBeenCalledWith(
      'No se pudo crear la sesión de Checkout de la reserva b1: type=StripeAuthenticationError code=api_key_invalid statusCode=401 requestId=req_123',
    );
    expect(String(logError.mock.calls[0][0])).not.toContain('sk_test');
  });

  it('un monto que Stripe rechaza (por ejemplo, bajo su mínimo) también es un 502', async () => {
    create.mockRejectedValue(
      Object.assign(new Error('Amount must convert to at least 50 cents.'), { type: 'StripeInvalidRequestError', statusCode: 400 }),
    );

    await expect(gateway().createSession({ ...BOOKING, total: 1 })).rejects.toThrow(BadGatewayException);
  });

  it('un error de red sin datos de Stripe igual es un 502', async () => {
    create.mockRejectedValue(new Error('socket hang up'));

    await expect(gateway().createSession(BOOKING)).rejects.toThrow(BadGatewayException);
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('reserva b1: Error'));
  });

  it('cancelSession expira la sesión en Stripe', async () => {
    await gateway().cancelSession('cs_test_9');

    expect(expire).toHaveBeenCalledWith('cs_test_9');
  });

  it('cancelSession deja salir el error de Stripe, para que quien llama lo registre', async () => {
    expire.mockRejectedValue(new Error('ya expirada'));

    await expect(gateway().cancelSession('cs_test_9')).rejects.toThrow('ya expirada');
  });

  it('describeStripeError no incluye el mensaje', () => {
    expect(describeStripeError(Object.assign(new Error('secreto'), { type: 'StripeAPIError' }))).toBe('type=StripeAPIError');
    expect(describeStripeError('texto')).toBe('texto');
  });
});
