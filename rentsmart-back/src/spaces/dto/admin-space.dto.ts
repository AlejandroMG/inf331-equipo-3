import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SpaceStatus } from '../../generated/prisma/enums';

export const MIN_REASON = 5;
export const MAX_REASON = 500;

/** Un espacio en la lista del administrador: de cualquier propietario y estado. */
export class AdminSpaceDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Sala Alameda' })
  name: string;

  @ApiProperty({ enum: SpaceStatus })
  status: SpaceStatus;

  @ApiProperty({ example: 'Camila Rojas' })
  ownerName: string;

  @ApiProperty({ example: 'camila@rentsmart.test' })
  ownerEmail: string;

  @ApiProperty({ type: String, nullable: true })
  typeName: string | null;

  @ApiProperty({ type: String, nullable: true })
  communeName: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Por qué se bloqueó; solo si está bloqueado' })
  blockedReason: string | null;

  @ApiProperty({ type: Date, nullable: true })
  blockedAt: Date | null;

  @ApiProperty()
  updatedAt: Date;
}

export class AdminSpacesPageDto {
  @ApiProperty({ type: [AdminSpaceDto] })
  items: AdminSpaceDto[];

  @ApiProperty({ example: 25 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;
}

export class ListAdminSpacesQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize: number = 20;

  @ApiPropertyOptional({ enum: SpaceStatus, description: 'Solo los espacios en este estado' })
  @IsOptional()
  @IsIn(Object.values(SpaceStatus))
  status?: SpaceStatus;

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Texto que debe estar en el nombre del espacio o en el nombre o el email de su propietario',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class BlockSpaceDto {
  @ApiProperty({
    minLength: MIN_REASON,
    maxLength: MAX_REASON,
    example: 'Las fotos no corresponden al espacio publicado',
    description: 'El motivo: lo ve el propietario',
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(MIN_REASON)
  @MaxLength(MAX_REASON)
  reason: string;
}
