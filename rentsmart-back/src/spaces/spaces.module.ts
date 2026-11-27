import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AdminSpacesController } from './admin-spaces.controller';
import { AdminSpacesService } from './admin-spaces.service';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { PublicationService } from './publication.service';
import { SpaceRemovalService } from './space-removal.service';
import { SpacesController } from './spaces.controller';
import { SpacesService } from './spaces.service';

@Module({
  imports: [AiModule],
  controllers: [SpacesController, PhotosController, AdminSpacesController],
  providers: [
    SpacesService,
    PhotosService,
    PublicationService,
    SpaceRemovalService,
    AdminSpacesService,
  ],
  exports: [SpacesService],
})
export class SpacesModule {}
