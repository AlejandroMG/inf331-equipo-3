import { Module } from '@nestjs/common';
import { AmenitiesController } from './amenities.controller';
import { RegionsController } from './regions.controller';
import { SpaceTypesController } from './space-types.controller';
import { SpaceTypesService } from './space-types.service';

@Module({
  controllers: [SpaceTypesController, AmenitiesController, RegionsController],
  providers: [SpaceTypesService],
  exports: [SpaceTypesService],
})
export class SpaceTypesModule {}
