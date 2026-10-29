import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CheckoutBooking, CheckoutGateway, CheckoutSession } from './checkout-gateway';

/** El mismo origen por defecto que CORS en `app.setup.ts`: el front de Vite en local. */
const DEFAULT_FRONTEND_URL = 'http://localhost:5173';

/**
 * Checkout provisorio de RE-02: no llama a Stripe ni cobra nada. Manda al arrendatario a la página de su reserva
 * en el front (`/bookings/<id>`), donde ve el estado y cuánto le queda de retención.
 *
 * PA-01 (#45): se reemplaza por la implementación de Stripe Checkout en `CheckoutModule`, sin tocar `BookingsService`.
 */
@Injectable()
export class PendingCheckoutGateway implements CheckoutGateway {
  constructor(private readonly config: ConfigService) {}

  createSession(booking: CheckoutBooking): Promise<CheckoutSession> {
    const frontend = (this.config.get<string>('FRONTEND_URL') ?? DEFAULT_FRONTEND_URL).replace(/\/+$/, '');
    return Promise.resolve({ url: `${frontend}/bookings/${encodeURIComponent(booking.id)}` });
  }
}
