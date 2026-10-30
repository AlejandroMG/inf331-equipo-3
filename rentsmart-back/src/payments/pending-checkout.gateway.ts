import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CheckoutBooking, CheckoutGateway, CheckoutSession } from './checkout-gateway';
import { bookingPageUrl } from './frontend-url';

/**
 * Checkout provisorio: no llama a Stripe ni cobra nada. Manda al arrendatario a la página de su reserva en el front
 * (`/bookings/<id>`), donde ve el estado y cuánto le queda de retención.
 *
 * Desde PA-01 (#45) solo se usa sin `STRIPE_SECRET_KEY` (desarrollo sin claves, CI y e2e; ver `chooseCheckoutGateway`
 * en `checkout.module.ts`). Como no hay sesión de Stripe, no devuelve `sessionId` y la reserva queda sin `Payment`.
 */
@Injectable()
export class PendingCheckoutGateway implements CheckoutGateway {
  constructor(private readonly config: ConfigService) {}

  createSession(booking: CheckoutBooking): Promise<CheckoutSession> {
    return Promise.resolve({ url: bookingPageUrl(this.config, booking.id) });
  }
}
