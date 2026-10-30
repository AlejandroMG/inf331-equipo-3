import { BadGatewayException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import { CheckoutBooking, CheckoutGateway, CheckoutSession } from './checkout-gateway';
import { bookingPageUrl } from './frontend-url';

/** Lo único que este gateway usa del cliente de Stripe; así los tests le pasan un doble pequeño. */
export type StripeCheckoutClient = {
  checkout: { sessions: Pick<Stripe['checkout']['sessions'], 'create' | 'expire'> };
};

/** Lo que ve el arrendatario si Stripe falla: no se cobró nada y la reserva no quedó creada. */
export const STRIPE_UNAVAILABLE_MESSAGE = 'No pudimos iniciar el pago con Stripe; intenta de nuevo';

/**
 * Stripe Checkout en modo test (PA-01, #45; sin Connect, P-12). Crea una sesión de pago en CLP por el `total` de la
 * reserva y devuelve su URL y su id, que `BookingsService.create` guarda en la reserva y en su `Payment`.
 *
 * - CLP no tiene decimales en Stripe: el monto va tal cual, sin multiplicar por 100.
 * - El id de la reserva va en `metadata.bookingId` y en `client_reference_id`, para que el webhook (PA-02) la encuentre.
 * - La sesión vence en el mismo instante que la retención (`expiresAt`, P-06). Stripe exige que `expires_at` quede al
 *   menos 30 minutos después de crear la sesión; con 31 minutos de retención queda un margen de unos 40 s o más (ver
 *   la enmienda a P-06).
 * - Después de pagar, Stripe vuelve a `/bookings/<id>?pago=ok`; si la persona cancela, a `?pago=cancelado`.
 * - Cualquier error de Stripe (red, clave, un monto que Stripe no acepta, como uno bajo su mínimo) responde 502 con un
 *   mensaje claro. El detalle técnico va al log, sin la clave ni datos de pago.
 *
 * La registra `CheckoutModule` (`chooseCheckoutGateway`) solo si está `STRIPE_SECRET_KEY`.
 */
export class StripeCheckoutGateway implements CheckoutGateway {
  private readonly logger = new Logger(StripeCheckoutGateway.name);

  constructor(
    private readonly stripe: StripeCheckoutClient,
    private readonly config: ConfigService,
  ) {}

  async createSession(booking: CheckoutBooking): Promise<CheckoutSession> {
    const bookingUrl = bookingPageUrl(this.config, booking.id);
    let session: Awaited<ReturnType<StripeCheckoutClient['checkout']['sessions']['create']>>;
    try {
      session = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        currency: 'clp',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'clp',
              unit_amount: booking.total,
              product_data: { name: `Reserva en ${booking.spaceName}` },
            },
          },
        ],
        metadata: { bookingId: booking.id },
        client_reference_id: booking.id,
        expires_at: Math.floor(booking.expiresAt.getTime() / 1000),
        success_url: `${bookingUrl}?pago=ok`,
        cancel_url: `${bookingUrl}?pago=cancelado`,
      });
    } catch (error) {
      this.logger.error(`No se pudo crear la sesión de Checkout de la reserva ${booking.id}: ${describeStripeError(error)}`);
      throw new BadGatewayException(STRIPE_UNAVAILABLE_MESSAGE);
    }
    if (!session.url) {
      this.logger.error(`Stripe creó la sesión ${session.id} de la reserva ${booking.id} sin URL`);
      // La sesión existe en Stripe pero no sirve: se intenta expirar, sin esperar.
      void this.cancelSession(session.id).catch((error: unknown) =>
        this.logger.warn(`No se pudo expirar la sesión ${session.id}: ${describeStripeError(error)}`),
      );
      throw new BadGatewayException(STRIPE_UNAVAILABLE_MESSAGE);
    }
    return { url: session.url, sessionId: session.id };
  }

  /** Expira una sesión que quedó sin reserva, para que nadie la pague. */
  async cancelSession(sessionId: string): Promise<void> {
    await this.stripe.checkout.sessions.expire(sessionId);
  }
}

/**
 * Lo técnico de un error del SDK de Stripe, para el log: tipo, código, estado HTTP e id de la solicitud. No incluye
 * el mensaje, que en un error de autenticación puede traer parte de la clave.
 */
export function describeStripeError(error: unknown): string {
  if (typeof error !== 'object' || error === null) return String(error);
  const { type, code, statusCode, requestId } = error as Record<string, unknown>;
  const parts = Object.entries({ type, code, statusCode, requestId })
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${String(value)}`);
  return parts.length > 0 ? parts.join(' ') : (error as Error).name || 'error desconocido';
}
