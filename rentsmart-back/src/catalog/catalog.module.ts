import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

@Module({
  controllers: [CatalogController, FavoritesController],
  providers: [CatalogService, FavoritesService],
})
export class CatalogModule {}
