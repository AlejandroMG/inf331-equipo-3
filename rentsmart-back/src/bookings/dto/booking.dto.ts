import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus, BookingUnit } from '../../generated/prisma/enums';

/** El espacio de una reserva, como lo ve el arrendatario. */
export class BookingSpaceDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Sala Alameda' })
  name: string;

  @ApiProperty({ type: String, nullable: true, example: 'Santiago' })
  communeName: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Dirección pública' })
  address: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Detalle privado de la dirección (depto, oficina, indicaciones). Solo en una reserva `CONFIRMED`; null en cualquier otro estado (P-09)',
  })
  addressDetail: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Foto de portada; null si no tiene' })
  coverUrl: string | null;
}

/** Una reserva del arrendatario. */
export class BookingDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: BookingStatus })
  status: BookingStatus;

  @ApiProperty({ enum: BookingUnit })
  unit: BookingUnit;

  @ApiProperty({ type: Date, description: 'UTC; el front lo muestra en America/Santiago' })
  startAt: Date;

  @ApiProperty({ type: Date })
  endAt: Date;

  @ApiProperty({ example: 24000, description: 'CLP enteros: el precio del espacio por las horas o el día' })
  subtotal: number;

  @ApiProperty({ example: 2400, description: 'CLP enteros: comisión de la plataforma, sumada al arrendatario' })
  fee: number;

  @ApiProperty({ example: 26400, description: 'CLP enteros: lo que paga el arrendatario (subtotal + fee)' })
  total: number;

  @ApiProperty({
    type: Date,
    nullable: true,
    description: 'Hasta cuándo se retiene el horario mientras se paga (30 min). Solo importa en `PENDING`',
  })
  expiresAt: Date | null;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ type: BookingSpaceDto })
  space: BookingSpaceDto;
}

export class BookingsPageDto {
  @ApiProperty({ type: [BookingDto] })
  items: BookingDto[];

  @ApiProperty({ example: 14 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;
}

/** Lo que devuelve crear una reserva: a dónde ir a pagar. */
export class BookingCheckoutDto {
  @ApiProperty()
  bookingId: string;

  @ApiProperty({
    example: 'https://checkout.stripe.com/c/pay/cs_test_...',
    description: 'Stripe Checkout: el front redirige aquí. Vence junto con la retención del horario',
  })
  checkoutUrl: string;
}
