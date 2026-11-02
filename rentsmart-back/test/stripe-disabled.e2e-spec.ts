import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { CHECKOUT_GATEWAY } from '../src/payments/checkout-gateway';
import { PendingCheckoutGateway } from '../src/payments/pending-checkout.gateway';
import { STRIPE_CLIENT } from '../src/payments/stripe.module';
import { createTestApp } from './utils/create-test-app';

// PA-01: los e2e nunca llaman a Stripe, aunque rentsmart-back/.env traiga una STRIPE_SECRET_KEY de verdad.
// test/utils/setup-env.ts deja la clave en '' para que ConfigModule no la vuelva a cargar desde el .env.
describe('Stripe apagado en los e2e', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('la clave queda vacía en el entorno', () => {
    expect(process.env.STRIPE_SECRET_KEY).toBe('');
    expect(process.env.STRIPE_WEBHOOK_SECRET).toBe('');
  });

  it('no hay cliente de Stripe y el checkout es el provisorio', () => {
    expect(app.get(STRIPE_CLIENT)).toBeNull();
    expect(app.get(CHECKOUT_GATEWAY)).toBeInstanceOf(PendingCheckoutGateway);
  });
});
