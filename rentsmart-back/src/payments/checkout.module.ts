import { Module } from '@nestjs/common';
import { CHECKOUT_GATEWAY } from './checkout-gateway';
import { PendingCheckoutGateway } from './pending-checkout.gateway';

/**
 * El puerto de checkout que usa `BookingsModule` al crear una reserva. Va en su propio módulo, separado de
 * `PaymentsModule`, para que el webhook de PA-02 pueda importar `BookingsModule` sin crear una dependencia circular.
 */
@Module({
  // PA-01 (#45): cambiar `PendingCheckoutGateway` por la implementación de Stripe Checkout.
  providers: [{ provide: CHECKOUT_GATEWAY, useClass: PendingCheckoutGateway }],
  exports: [CHECKOUT_GATEWAY],
})
export class CheckoutModule {}
