import { ConfigService } from '@nestjs/config';
import { PendingCheckoutGateway } from './pending-checkout.gateway';

const BOOKING = {
  id: 'b1',
  spaceName: 'Sala Alameda',
  subtotal: 24000,
  fee: 2400,
  total: 26400,
  // No influye en la URL; se calcula desde ahora, como la retención de una reserva recién creada.
  expiresAt: new Date(Date.now() + 30 * 60_000),
};

const gateway = (frontendUrl?: string) =>
  new PendingCheckoutGateway({ get: () => frontendUrl } as unknown as ConfigService);

describe('PendingCheckoutGateway', () => {
  it('manda a la página de la reserva en el front, sin sesión de Stripe', async () => {
    await expect(gateway('https://rentsmart.test').createSession(BOOKING)).resolves.toEqual({
      url: 'https://rentsmart.test/bookings/b1',
    });
  });

  it('no duplica la barra si FRONTEND_URL termina en una', async () => {
    const { url } = await gateway('https://rentsmart.test/').createSession(BOOKING);

    expect(url).toBe('https://rentsmart.test/bookings/b1');
  });

  it('sin FRONTEND_URL usa el front de Vite en local', async () => {
    const { url } = await gateway().createSession(BOOKING);

    expect(url).toBe('http://localhost:5173/bookings/b1');
  });
});
