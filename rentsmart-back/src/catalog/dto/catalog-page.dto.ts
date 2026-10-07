import { ApiProperty } from '@nestjs/swagger';
import { CatalogItemDto } from './catalog-item.dto';

export class CatalogPageDto {
  @ApiProperty({ type: [CatalogItemDto] })
  items: CatalogItemDto[];

  @ApiProperty({ example: 14, description: 'Total de espacios activos' })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 12 })
  pageSize: number;
}
