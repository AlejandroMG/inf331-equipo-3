import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus, BookingUnit } from '../../generated/prisma/enums';

/** Cómo contactar al arrendatario. Solo lo ve el propietario, y solo en una reserva confirmada. */
export class RenterContactDto {
  @ApiProperty({ example: 'arrendatario@rentsmart.test' })
  email: string;

  @ApiProperty({ type: String, nullable: true, example: '+56 9 1234 5678' })
  phone: string | null;
}

/** Una reserva de uno de mis espacios, en el panel del propietario. */
export class OwnerBookingDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  spaceId: string;

  @ApiProperty({ example: 'Sala Alameda' })
  spaceName: string;

  @ApiProperty({ example: 'Camila Rojas' })
  renterName: string;

  @ApiProperty({ type: Date, description: 'UTC; el front lo muestra en America/Santiago' })
  startAt: Date;

  @ApiProperty({ type: Date })
  endAt: Date;

  @ApiProperty({ enum: BookingUnit })
  unit: BookingUnit;

  @ApiProperty({
    example: 36000,
    description: 'CLP enteros: lo que recibe el propietario, sin la comisión de la plataforma',
  })
  subtotal: number;

  @ApiProperty({ enum: BookingStatus })
  status: BookingStatus;

  @ApiProperty({
    type: RenterContactDto,
    nullable: true,
    description: 'Solo en reservas confirmadas; null en cualquier otro estado',
  })
  contact: RenterContactDto | null;
}

export class OwnerBookingsPageDto {
  @ApiProperty({ type: [OwnerBookingDto] })
  items: OwnerBookingDto[];

  @ApiProperty({ example: 14 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;
}
