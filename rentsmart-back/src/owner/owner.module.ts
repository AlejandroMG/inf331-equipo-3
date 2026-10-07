import { Module } from '@nestjs/common';
import { OwnerBookingsService } from './owner-bookings.service';
import { OwnerController } from './owner.controller';
import { OwnerMetricsService } from './owner-metrics.service';

/** Panel del propietario: lo que ve de las reservas de sus espacios y sus métricas (PN-02, PN-04). */
@Module({
  controllers: [OwnerController],
  providers: [OwnerBookingsService, OwnerMetricsService],
})
export class OwnerModule {}
