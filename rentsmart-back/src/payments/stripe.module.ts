import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * Token del cliente de Stripe (`Stripe | null`). Vale `null` si no está `STRIPE_SECRET_KEY`: así la API arranca sin
 * claves en desarrollo, en el CI y en los e2e. Lo usa el checkout (PA-01) y sirve también para el webhook (PA-02) y
 * los reembolsos (PA-03): el módulo que lo necesite importa `StripeModule` e inyecta `@Inject(STRIPE_CLIENT)`.
 */
export const STRIPE_CLIENT = Symbol('STRIPE_CLIENT');

/**
 * Límites de cada llamada a Stripe. `BookingsService.create` crea la sesión dentro de una transacción que dura a lo
 * más 15 s: con 6 s por intento y un reintento, la llamada termina antes que la transacción.
 */
export const STRIPE_TIMEOUT_MS = 6_000;
export const STRIPE_MAX_NETWORK_RETRIES = 1;

/** Crea el cliente de Stripe con la clave secreta, o `null` si la variable no existe o está vacía. */
export function createStripeClient(config: ConfigService): Stripe | null {
  const secretKey = config.get<string>('STRIPE_SECRET_KEY');
  if (!secretKey) return null;
  return new Stripe(secretKey, { timeout: STRIPE_TIMEOUT_MS, maxNetworkRetries: STRIPE_MAX_NETWORK_RETRIES });
}

@Module({
  providers: [{ provide: STRIPE_CLIENT, inject: [ConfigService], useFactory: createStripeClient }],
  exports: [STRIPE_CLIENT],
})
export class StripeModule {}
