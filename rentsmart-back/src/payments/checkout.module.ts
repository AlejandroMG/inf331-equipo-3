import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import { CHECKOUT_GATEWAY, type CheckoutGateway } from './checkout-gateway';
import { PendingCheckoutGateway } from './pending-checkout.gateway';
import { StripeCheckoutGateway } from './stripe-checkout.gateway';
import { STRIPE_CLIENT, StripeModule } from './stripe.module';

/**
 * Elige el checkout (PA-01): Stripe Checkout si hay cliente de Stripe (está `STRIPE_SECRET_KEY`) y, si no, el
 * provisorio, que manda a la página de la reserva sin cobrar. Así el desarrollo sin claves, el CI y los e2e funcionan
 * sin Stripe.
 */
export function chooseCheckoutGateway(stripe: Stripe | null, config: ConfigService): CheckoutGateway {
  return stripe ? new StripeCheckoutGateway(stripe, config) : new PendingCheckoutGateway(config);
}

/**
 * El puerto de checkout que usa `BookingsModule` al crear una reserva. Va en su propio módulo, separado de
 * `PaymentsModule`, para que el webhook de PA-02 pueda importar `BookingsModule` sin crear una dependencia circular.
 */
@Module({
  imports: [StripeModule],
  providers: [{ provide: CHECKOUT_GATEWAY, inject: [STRIPE_CLIENT, ConfigService], useFactory: chooseCheckoutGateway }],
  exports: [CHECKOUT_GATEWAY],
})
export class CheckoutModule {}
