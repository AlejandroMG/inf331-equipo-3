import { Injectable, NotImplementedException } from '@nestjs/common';
import { PageQueryDto } from '../bookings/dto/page-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsPageDto, WebhookAckDto } from './dto/payment.dto';

/**
 * Pagos del arrendatario. `findMine` está implementado (PA-01); el webhook de Stripe responde 501 hasta PA-02 (#46).
 *
 * Un `Payment` nace `PENDING` junto con la reserva, cuando el checkout es Stripe (`BookingsService.create`). Con el
 * checkout provisorio (sin `STRIPE_SECRET_KEY`) no hay sesión de Stripe y la reserva queda sin `Payment`.
 */
@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** `rawBody` es el cuerpo tal como llegó: Stripe firma esos bytes, no el JSON ya interpretado. */
  handleWebhook(_rawBody: Buffer | undefined, _signature: string): Promise<WebhookAckDto> {
    throw new NotImplementedException('El webhook de Stripe todavía no está implementado (PA-02)');
  }

  /** Los pagos de las reservas donde soy el arrendatario, los creados más recientemente primero. */
  async findMine(userId: string, { page, pageSize }: PageQueryDto): Promise<PaymentsPageDto> {
    const where = { booking: { renterId: userId } };
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: { booking: { select: { space: { select: { name: true } } } } },
        // El id desempata dos pagos creados en el mismo milisegundo, así las páginas no se cruzan.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);
    const items = payments.map((payment) => ({
      id: payment.id,
      bookingId: payment.bookingId,
      spaceName: payment.booking.space.name,
      amount: payment.amount,
      fee: payment.fee,
      refundedAmount: payment.refundedAmount,
      status: payment.status,
      createdAt: payment.createdAt,
    }));
    return { items, total, page, pageSize };
  }
}
