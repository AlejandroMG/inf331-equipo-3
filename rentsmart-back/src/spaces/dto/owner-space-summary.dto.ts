import { ApiProperty } from '@nestjs/swagger';
import { SpaceStatus } from '../../generated/prisma/enums';

/** Un espacio en la lista del propietario (panel "Mis espacios"). */
export class OwnerSpaceSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: SpaceStatus })
  status: SpaceStatus;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, nullable: true })
  typeName: string | null;

  @ApiProperty({ type: String, nullable: true })
  communeName: string | null;

  @ApiProperty({ type: Number, nullable: true })
  pricePerHour: number | null;

  @ApiProperty({ type: Number, nullable: true })
  pricePerDay: number | null;

  @ApiProperty({ type: String, nullable: true, description: 'Foto de portada' })
  coverUrl: string | null;

  @ApiProperty({
    type: [String],
    description:
      'Lo que falta para publicarlo o mantenerlo publicado: type, description, capacity, commune, price, photos o schedule. Vacío si está completo',
  })
  missing: string[];

  @ApiProperty()
  updatedAt: Date;
}
