import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const MAX_PRICE = 10_000_000;

/**
 * Datos de un espacio mientras se publica. Solo el nombre es obligatorio: el formulario por pasos
 * guarda un borrador en cada paso, y las reglas para publicar (ES-04) se validan después.
 * En una actualización `null` borra el valor de un campo opcional.
 */
export class CreateSpaceDto {
  @ApiProperty({ example: 'Sala de reuniones Alameda', maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 1 })
  @IsOptional()
  @IsInt()
  typeId?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 10, minimum: 1, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  capacity?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 12000, description: 'CLP enteros' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PRICE)
  pricePerHour?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 90000, description: 'CLP enteros' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PRICE)
  pricePerDay?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 1 })
  @IsOptional()
  @IsInt()
  regionId?: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 3,
    description: 'Debe pertenecer a la región; si no se manda la región, se toma la de la comuna',
  })
  @IsOptional()
  @IsInt()
  communeId?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 200, description: 'Dirección pública' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 200,
    description: 'Piso, oficina e indicaciones. Solo lo ve quien tenga una reserva confirmada',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressDetail?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rules?: string | null;

  @ApiPropertyOptional({ type: [Number], description: 'Reemplaza el equipamiento completo' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsInt({ each: true })
  amenityIds?: number[];
}
