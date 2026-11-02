import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { PAYMENT_REFUNDER } from './payment-refunder';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PendingPaymentRefunder } from './pending-payment.refunder';
import { StripeModule } from './stripe.module';

/** Stripe Checkout, su webhook y el registro de pagos (PA-01, PA-02). */
@Module({
  // BookingsModule usa CheckoutModule, no este módulo, así que no hay dependencia circular.
  imports: [BookingsModule, StripeModule],
  controllers: [PaymentsController],
  // Provisorio: al integrar PA-03 (#47), se reemplaza por importar RefundsModule, que exporta PAYMENT_REFUNDER.
  providers: [PaymentsService, { provide: PAYMENT_REFUNDER, useClass: PendingPaymentRefunder }],
  exports: [PaymentsService],
})
export class PaymentsModule {}
