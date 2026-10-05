import { ApiProperty } from '@nestjs/swagger';
import { SpaceStatus } from '../../generated/prisma/enums';

/** Espacio visto por su propietario: incluye el estado y el detalle privado de la dirección. */
export class SpaceDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: SpaceStatus, example: SpaceStatus.DRAFT })
  status: SpaceStatus;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: Number, nullable: true })
  typeId: number | null;

  @ApiProperty({ type: String, nullable: true })
  description: string | null;

  @ApiProperty({ type: Number, nullable: true })
  capacity: number | null;

  @ApiProperty({ type: Number, nullable: true })
  pricePerHour: number | null;

  @ApiProperty({ type: Number, nullable: true })
  pricePerDay: number | null;

  @ApiProperty({ type: Number, nullable: true })
  regionId: number | null;

  @ApiProperty({ type: Number, nullable: true })
  communeId: number | null;

  @ApiProperty({ type: String, nullable: true })
  address: string | null;

  @ApiProperty({ type: String, nullable: true })
  addressDetail: string | null;

  @ApiProperty({ type: String, nullable: true })
  rules: string | null;

  @ApiProperty({ type: [Number] })
  amenityIds: number[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
