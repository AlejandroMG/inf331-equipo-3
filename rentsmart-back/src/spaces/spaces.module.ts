import { Module } from '@nestjs/common';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { SpacesController } from './spaces.controller';
import { SpacesService } from './spaces.service';

@Module({
  controllers: [SpacesController, PhotosController],
  providers: [SpacesService, PhotosService],
  exports: [SpacesService],
})
export class SpacesModule {}
