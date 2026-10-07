import { ApiProperty } from '@nestjs/swagger';

export class CatalogPhotoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  url: string;

  @ApiProperty({ example: 0, description: '0 es la portada' })
  position: number;
}

export class CatalogScheduleDto {
  @ApiProperty({ example: 1, description: '0 = domingo ... 6 = sábado' })
  weekday: number;

  @ApiProperty({ example: '09:00' })
  startTime: string;

  @ApiProperty({ example: '21:00' })
  endTime: string;
}

/** Zona donde está el espacio: un círculo, no un punto (ES-07). */
export class CatalogLocationDto {
  @ApiProperty({ example: -33.449 })
  latitude: number;

  @ApiProperty({ example: -70.669 })
  longitude: number;

  @ApiProperty({ example: 150, description: 'Radio del círculo en metros; el espacio queda dentro de él' })
  radiusMeters: number;
}

/**
 * Detalle público de un espacio. Incluye la dirección pública, pero nunca `addressDetail`:
 * solo lo ve quien tiene una reserva confirmada (P-09).
 */
export class CatalogDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, nullable: true })
  description: string | null;

  @ApiProperty()
  typeName: string;

  @ApiProperty()
  regionName: string;

  @ApiProperty()
  communeName: string;

  @ApiProperty({ type: String, nullable: true, description: 'Dirección pública' })
  address: string | null;

  @ApiProperty({
    type: CatalogLocationDto,
    nullable: true,
    description: 'Ubicación aproximada, si el propietario marcó el punto. Nunca trae el punto exacto',
  })
  location: CatalogLocationDto | null;

  @ApiProperty()
  capacity: number;

  @ApiProperty({ type: Number, nullable: true })
  pricePerHour: number | null;

  @ApiProperty({ type: Number, nullable: true })
  pricePerDay: number | null;

  @ApiProperty({ type: String, nullable: true })
  rules: string | null;

  @ApiProperty({ type: [String], description: 'Nombres del equipamiento, por orden alfabético' })
  amenities: string[];

  @ApiProperty({ type: [CatalogPhotoDto], description: 'Por posición; la primera es la portada' })
  photos: CatalogPhotoDto[];

  @ApiProperty({ type: [CatalogScheduleDto], description: 'Horario semanal de arriendo' })
  schedule: CatalogScheduleDto[];
}
