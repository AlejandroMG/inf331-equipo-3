import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '../../generated/prisma/enums';

/** Un pago del arrendatario, para su panel. */
export class PaymentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  bookingId: string;

  @ApiProperty({ example: 'Sala Alameda' })
  spaceName: string;

  @ApiProperty({ example: 26400, description: 'CLP enteros: lo que se cobró (el total de la reserva)' })
  amount: number;

  @ApiProperty({ example: 2400, description: 'CLP enteros: la parte que es comisión de la plataforma' })
  fee: number;

  @ApiProperty({ example: 0, description: 'CLP enteros: lo que se devolvió' })
  refundedAmount: number;

  @ApiProperty({ enum: PaymentStatus })
  status: PaymentStatus;

  @ApiProperty({ type: Date })
  createdAt: Date;
}

export class PaymentsPageDto {
  @ApiProperty({ type: [PaymentDto] })
  items: PaymentDto[];

  @ApiProperty({ example: 14 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;
}

/** Respuesta al webhook: Stripe solo mira el código 2xx. */
export class WebhookAckDto {
  @ApiProperty({ example: true })
  received: boolean;
}
