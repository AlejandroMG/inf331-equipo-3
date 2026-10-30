/**
 * Puerto de checkout: dónde paga el arrendatario una reserva recién creada. `BookingsService.create` solo conoce esta
 * interfaz, así que cambiar de implementación no toca las reservas.
 *
 * Implementaciones (las elige `CheckoutModule` según `STRIPE_SECRET_KEY`):
 * - `StripeCheckoutGateway` (PA-01, #45): crea la Checkout Session en CLP por `total`, con el id de la reserva en los
 *   metadatos, y devuelve su `sessionId`. La sesión vence en `expiresAt`: la retención es de 31 minutos (P-06) para
 *   cumplir con margen el mínimo de Stripe (`expires_at` ≥ creación + 30 min).
 * - `PendingCheckoutGateway`: sin Stripe, manda a la página de la reserva y no devuelve `sessionId`.
 *
 * Advertencias:
 * - `createSession` se llama dentro de la transacción de `BookingsService.create`. Si falla, la reserva se deshace.
 *   Si la sesión se crea y después falla el resto de la transacción (o el COMMIT), `create` llama a `cancelSession`
 *   para expirarla, sin esperar. Si eso también falla, o si Stripe creó la sesión pero la respuesta no llegó, queda
 *   una sesión sin reserva hasta que venza sola: el webhook de PA-02 debe tolerar un evento cuyo id de reserva no
 *   existe (responder 200 sin hacer nada).
 */
export interface CheckoutGateway {
  createSession(booking: CheckoutBooking): Promise<CheckoutSession>;
  /** Anula una sesión que quedó sin reserva. Opcional: el checkout provisorio no crea sesiones. */
  cancelSession?(sessionId: string): Promise<void>;
}

/** Lo que el checkout necesita saber de la reserva. Montos en CLP enteros. */
export interface CheckoutBooking {
  id: string;
  spaceName: string;
  subtotal: number;
  fee: number;
  total: number;
  /** Hasta cuándo se retiene el horario (P-06): la sesión de pago vence en ese mismo instante. */
  expiresAt: Date;
}

/** A dónde redirigir al arrendatario y, si el proveedor la tiene, el id de su sesión (se guarda en la reserva). */
export interface CheckoutSession {
  url: string;
  sessionId?: string;
}

/** Token de inyección de `CheckoutGateway` (las interfaces no existen en tiempo de ejecución). */
export const CHECKOUT_GATEWAY = Symbol('CHECKOUT_GATEWAY');
