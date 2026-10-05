import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validate } from './config/env.validation';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { SpaceTypesModule } from './space-types/space-types.module';
import { SpacesModule } from './spaces/spaces.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    PrismaModule,
    SpaceTypesModule,
    SpacesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
