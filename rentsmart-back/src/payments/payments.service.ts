import { Injectable, NotImplementedException } from '@nestjs/common';
import { PageQueryDto } from '../bookings/dto/page-query.dto';
import { PaymentsPageDto, WebhookAckDto } from './dto/payment.dto';

/**
 * Contrato de F-05: los métodos quedan definidos y responden 501 hasta que exista su historia
 * (PA-02 el webhook, PA-01 y PN-03 los pagos del arrendatario).
 */
@Injectable()
export class PaymentsService {
  /** `rawBody` es el cuerpo tal como llegó: Stripe firma esos bytes, no el JSON ya interpretado. */
  handleWebhook(_rawBody: Buffer | undefined, _signature: string): Promise<WebhookAckDto> {
    throw new NotImplementedException('El webhook de Stripe todavía no está implementado (PA-02)');
  }

  findMine(_userId: string, _query: PageQueryDto): Promise<PaymentsPageDto> {
    throw new NotImplementedException('Mis pagos todavía no está implementado (PA-01)');
  }
}
