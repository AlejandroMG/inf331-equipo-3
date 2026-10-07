import { Module } from '@nestjs/common';
import { AdminSpaceTypesController } from './admin-space-types.controller';
import { AdminSpaceTypesService } from './admin-space-types.service';
import { AmenitiesController } from './amenities.controller';
import { RegionsController } from './regions.controller';
import { SpaceTypesController } from './space-types.controller';
import { SpaceTypesService } from './space-types.service';

@Module({
  controllers: [
    SpaceTypesController,
    AmenitiesController,
    RegionsController,
    AdminSpaceTypesController,
  ],
  providers: [SpaceTypesService, AdminSpaceTypesService],
  exports: [SpaceTypesService],
})
export class SpaceTypesModule {}
