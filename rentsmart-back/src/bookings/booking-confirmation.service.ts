import { Injectable } from '@nestjs/common';

/**
 * Validación automática después del pago (P-06). El webhook de Stripe (PA-02) la llama cuando la reserva queda `PAID`.
 * Por ahora no hace nada, y la reserva queda `PAID`: la implementa RE-04 (#41), que la pasa a `CONFIRMED` o la cancela
 * con reembolso total.
 */
@Injectable()
export class BookingConfirmationService {
  confirm(_bookingId: string, _now?: Date): Promise<void> {
    return Promise.resolve();
  }
}
