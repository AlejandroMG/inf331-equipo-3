import { ApiProperty } from '@nestjs/swagger';

/** Espacio tal como se muestra en el catálogo. Nunca incluye la dirección privada. */
export class CatalogItemDto {
  @ApiProperty({ example: 'b7c1c2e0-6a43-4a6d-9a5f-0f2f7c1f9d11' })
  id: string;

  @ApiProperty({ example: 'Sala Alameda' })
  name: string;

  @ApiProperty({ example: 'Sala de reuniones' })
  typeName: string;

  @ApiProperty({ example: 'Santiago' })
  communeName: string;

  @ApiProperty({ example: 10 })
  capacity: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 12000,
    description: 'CLP enteros; null si no se arrienda por hora',
  })
  pricePerHour: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 90000,
    description: 'CLP enteros; null si no se arrienda por día',
  })
  pricePerDay: number | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Foto de portada; null si todavía no tiene',
  })
  coverUrl: string | null;
}
