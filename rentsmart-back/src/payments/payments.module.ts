import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RefundsModule } from './refunds.module';
import { StripeModule } from './stripe.module';

/** Stripe Checkout, su webhook y el registro de pagos (PA-01, PA-02). Los reembolsos van en `RefundsModule` (PA-03). */
@Module({
  // BookingsModule usa CheckoutModule, no este módulo, así que no hay dependencia circular.
  imports: [BookingsModule, RefundsModule, StripeModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
