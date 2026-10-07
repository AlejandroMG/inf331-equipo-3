import { PickType } from '@nestjs/swagger';
import { ListCatalogQueryDto } from './list-catalog-query.dto';

/** Paginación de los favoritos: la misma `page` y `pageSize` que el catálogo, y nada más. */
export class ListFavoritesQueryDto extends PickType(ListCatalogQueryDto, [
  'page',
  'pageSize',
] as const) {}
