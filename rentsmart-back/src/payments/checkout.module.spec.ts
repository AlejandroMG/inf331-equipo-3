import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type Stripe from 'stripe';
import { validate } from '../config/env.validation';
import { CHECKOUT_GATEWAY } from './checkout-gateway';
import { CheckoutModule } from './checkout.module';
import { PendingCheckoutGateway } from './pending-checkout.gateway';
import { StripeCheckoutGateway } from './stripe-checkout.gateway';
import { createStripeClient, STRIPE_CLIENT, STRIPE_MAX_NETWORK_RETRIES, STRIPE_TIMEOUT_MS } from './stripe.module';

// Elegir el checkout según STRIPE_SECRET_KEY (PA-01). Crear el cliente de Stripe no hace ninguna llamada a la red, y
// todas las claves de este archivo son inventadas.
const FAKE_KEY = 'sk_test_fake_no_es_una_clave_real';
const KEYS = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] as const;

describe('CheckoutModule: qué checkout usa', () => {
  let saved: Partial<Record<(typeof KEYS)[number], string>>;
  beforeEach(() => {
    saved = {};
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });
  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  describe('con la configuración en memoria (sin .env)', () => {
    // ConfigService.get prefiere process.env a lo de `load`: por eso el beforeEach saca las claves del entorno, y aquí
    // manda solo lo que se pasa en `env`.
    const compile = (env: Record<string, string>) =>
      Test.createTestingModule({
        imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => env] }), CheckoutModule],
      }).compile();

    it('con STRIPE_SECRET_KEY usa Stripe Checkout, con un cliente de Stripe con tiempo máximo', async () => {
      const module = await compile({ STRIPE_SECRET_KEY: FAKE_KEY });

      expect(module.get(CHECKOUT_GATEWAY)).toBeInstanceOf(StripeCheckoutGateway);
      const stripe = module.get<Stripe>(STRIPE_CLIENT);
      expect(typeof stripe.checkout.sessions.create).toBe('function');
      expect(stripe.getApiField('timeout')).toBe(STRIPE_TIMEOUT_MS);
      expect(stripe.getMaxNetworkRetries()).toBe(STRIPE_MAX_NETWORK_RETRIES);
      // La llamada a Stripe tiene que terminar antes que la transacción de la reserva (15 s).
      expect(STRIPE_TIMEOUT_MS * (STRIPE_MAX_NETWORK_RETRIES + 1)).toBeLessThan(15_000);
    });

    it('sin STRIPE_SECRET_KEY usa el checkout provisorio y no hay cliente de Stripe', async () => {
      const module = await compile({});

      expect(module.get(CHECKOUT_GATEWAY)).toBeInstanceOf(PendingCheckoutGateway);
      expect(module.get(STRIPE_CLIENT)).toBeNull();
    });

    it('una STRIPE_SECRET_KEY vacía cuenta como que no está, y la validación la acepta', async () => {
      const module = await compile({ STRIPE_SECRET_KEY: '' });

      expect(module.get(CHECKOUT_GATEWAY)).toBeInstanceOf(PendingCheckoutGateway);
      expect(createStripeClient({ get: () => '' } as unknown as ConfigService)).toBeNull();
      expect(() =>
        validate({ DATABASE_URL: 'postgresql://u:p@localhost:5432/db', JWT_SECRET: 'x'.repeat(32), STRIPE_SECRET_KEY: '' }),
      ).not.toThrow();
    });
  });

  // La causa del arreglo de test/utils/setup-env.ts: ConfigModule.forRoot copia a process.env las variables del .env
  // que no estén definidas. Se usa un .env temporal con una clave falsa, nunca el .env real.
  describe('con un archivo .env que trae una clave', () => {
    let dir: string;
    let envFile: string;
    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'rentsmart-env-'));
      envFile = join(dir, '.env');
      writeFileSync(envFile, `STRIPE_SECRET_KEY=${FAKE_KEY}\nSTRIPE_WEBHOOK_SECRET=whsec_fake\n`);
    });
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    const compile = () =>
      Test.createTestingModule({
        imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: envFile }), CheckoutModule],
      }).compile();

    it('si la variable no existe en el entorno, el .env la vuelve a poner: borrarla no apaga Stripe', async () => {
      const module = await compile();

      expect(process.env.STRIPE_SECRET_KEY).toBe(FAKE_KEY);
      expect(module.get(CHECKOUT_GATEWAY)).toBeInstanceOf(StripeCheckoutGateway);
    });

    it('con la variable en cadena vacía gana el vacío: no hay cliente de Stripe', async () => {
      process.env.STRIPE_SECRET_KEY = '';
      process.env.STRIPE_WEBHOOK_SECRET = '';

      const module = await compile();

      expect(process.env.STRIPE_SECRET_KEY).toBe('');
      expect(module.get(ConfigService).get('STRIPE_SECRET_KEY')).toBe('');
      expect(module.get(STRIPE_CLIENT)).toBeNull();
      expect(module.get(CHECKOUT_GATEWAY)).toBeInstanceOf(PendingCheckoutGateway);
    });
  });
});
