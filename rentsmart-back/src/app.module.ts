import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validate } from './config/env.validation';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { SpaceTypesModule } from './space-types/space-types.module';
import { SpacesModule } from './spaces/spaces.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { OwnerModule } from './owner/owner.module';
import { AvailabilityModule } from './availability/availability.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from './payments/payments.module';
import { UsersModule } from './users/users.module';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ThrottlerModule.forRoot([{ ttl: 15 * 60 * 1000, limit: 10 }]),
    // Tareas periódicas: vencimientos automáticos de reservas (RE-06).
    ScheduleModule.forRoot(),
    PrismaModule,
    StorageModule,
    SpaceTypesModule,
    SpacesModule,
    AuthModule,
    CatalogModule,
    OwnerModule,
    AvailabilityModule,
    BookingsModule,
    PaymentsModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
