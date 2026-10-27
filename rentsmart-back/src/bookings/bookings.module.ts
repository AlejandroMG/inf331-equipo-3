import { Module } from '@nestjs/common';
import { BookingExpiryScheduler } from './booking-expiry.scheduler';
import { BookingExpiryService } from './booking-expiry.service';
import { BookingStateService } from './booking-state.service';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

/** Reservas del arrendatario, su máquina de estados y sus vencimientos automáticos (RE-01 a RE-06). */
@Module({
  controllers: [BookingsController],
  providers: [BookingsService, BookingStateService, BookingExpiryService, BookingExpiryScheduler],
  exports: [BookingsService, BookingStateService, BookingExpiryService],
})
export class BookingsModule {}
