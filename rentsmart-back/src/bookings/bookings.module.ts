import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { CheckoutModule } from '../payments/checkout.module';
import { RefundsModule } from '../payments/refunds.module';
import { BookingExpiryScheduler } from './booking-expiry.scheduler';
import { BookingExpiryService } from './booking-expiry.service';
import { BookingStateService } from './booking-state.service';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

/** Reservas del arrendatario, su máquina de estados y sus vencimientos automáticos (RE-01 a RE-06). */
@Module({
  // Reservar (RE-02) revisa la disponibilidad (DI-02) y pide el enlace de pago al puerto de checkout (PA-01).
  // Cancelar (RE-05) reembolsa con el puerto de PA-03.
  imports: [AvailabilityModule, CheckoutModule, RefundsModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingStateService, BookingExpiryService, BookingExpiryScheduler],
  exports: [BookingsService, BookingStateService, BookingExpiryService],
})
export class BookingsModule {}
