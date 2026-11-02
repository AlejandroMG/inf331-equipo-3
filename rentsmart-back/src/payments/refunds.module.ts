import { Module } from '@nestjs/common';
import type Stripe from 'stripe';
import { PaymentRefundService } from './payment-refund.service';
import { PAYMENT_REFUNDER } from './payment-refunder';
import { NoopRefundGateway, REFUND_GATEWAY, StripeRefundGateway, type RefundGateway } from './refund-gateway';
import { STRIPE_CLIENT, StripeModule } from './stripe.module';

/** Elige el proveedor de los reembolsos (PA-03): Stripe si hay cliente (está `STRIPE_SECRET_KEY`), como `CheckoutModule`. */
export function chooseRefundGateway(stripe: Stripe | null): RefundGateway {
  return stripe ? new StripeRefundGateway(stripe) : new NoopRefundGateway();
}

/**
 * Reembolsos (PA-03). Va en su propio módulo, separado de `PaymentsModule`, porque PA-02 hace que `PaymentsModule`
 * importe `BookingsModule` y `BookingsModule` necesita reembolsar al cancelar: así no hay dependencia circular. El
 * módulo que reembolse (PA-02, RE-04) importa `RefundsModule` e inyecta `@Inject(PAYMENT_REFUNDER)`.
 */
@Module({
  imports: [StripeModule],
  providers: [
    { provide: REFUND_GATEWAY, inject: [STRIPE_CLIENT], useFactory: chooseRefundGateway },
    PaymentRefundService,
    { provide: PAYMENT_REFUNDER, useExisting: PaymentRefundService },
  ],
  exports: [PAYMENT_REFUNDER],
})
export class RefundsModule {}
