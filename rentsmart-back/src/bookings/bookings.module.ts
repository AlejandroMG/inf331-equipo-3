import { Module } from '@nestjs/common';
import { BookingStateService } from './booking-state.service';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

/** Reservas del arrendatario y su máquina de estados (RE-01 a RE-06). */
@Module({
  controllers: [BookingsController],
  providers: [BookingsService, BookingStateService],
  exports: [BookingsService, BookingStateService],
})
export class BookingsModule {}
