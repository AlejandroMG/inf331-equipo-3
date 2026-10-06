import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 50;
/** Los mismos topes que al publicar: ningún espacio pasa de estos valores. */
export const MAX_PRICE = 10_000_000;
export const MAX_CAPACITY = 1000;
export const MAX_SEARCH_LENGTH = 100;
// Los ids son Int de Postgres; sin tope, un número enorme haría fallar la consulta con un 500.
const MAX_ID = 2_147_483_647;

export class ListCatalogQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'Número de página' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: DEFAULT_PAGE_SIZE,
    description: 'Espacios por página',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({
    minimum: 1,
    description: 'Tipo de espacio (id de GET /api/space-types)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ID)
  typeId?: number;

  @ApiPropertyOptional({
    minimum: 1,
    description: 'Comuna (id de GET /api/regions/:id/communes)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ID)
  communeId?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: MAX_PRICE,
    description:
      'Precio por hora mínimo, en CLP. Deja fuera los espacios que no se arriendan por hora',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  minPrice?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: MAX_PRICE,
    description:
      'Precio por hora máximo, en CLP. Deja fuera los espacios que no se arriendan por hora',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  maxPrice?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_CAPACITY,
    description: 'Capacidad mínima: espacios para esa cantidad de personas o más',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_CAPACITY)
  minCapacity?: number;

  @ApiPropertyOptional({
    maxLength: MAX_SEARCH_LENGTH,
    description:
      'Texto libre. Cada palabra debe aparecer en el nombre, la descripción, el tipo o la comuna, sin distinguir mayúsculas',
  })
  // Un texto en blanco es como no buscar nada.
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    return value.trim() === '' ? undefined : value.trim();
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SEARCH_LENGTH)
  q?: string;
}
