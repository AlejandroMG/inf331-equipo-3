/**
 * Puerto de checkout: dónde paga el arrendatario una reserva recién creada. `BookingsService.create` solo conoce esta
 * interfaz, así que cambiar de implementación no toca las reservas.
 *
 * PA-01 (#45): la implementación de Stripe Checkout reemplaza a `PendingCheckoutGateway` en `CheckoutModule`
 * (`{ provide: CHECKOUT_GATEWAY, useClass: StripeCheckoutGateway }`). Debe crear la sesión en CLP por `total`, con
 * `success_url` a `/bookings/<id>` del front y el id de la reserva en los metadatos, para que el webhook (PA-02) la
 * encuentre, y devolver el id de la sesión en `sessionId`. Dos advertencias para PA-01:
 *
 * - Stripe exige `expires_at` ≥ creación + 30 min, así que no puede ser igual a `expiresAt` (la reserva se crea antes
 *   que la sesión); cómo calzar los dos plazos se decide en PA-01.
 * - `createSession` se llama dentro de la transacción de `BookingsService.create`. Si falla, la reserva se deshace.
 *   Pero si la sesión se crea y después el COMMIT falla, queda una sesión de Stripe sin reserva: el webhook de PA-02
 *   debe tolerar un evento cuyo id de reserva no existe (responder 200 sin hacer nada).
 */
export interface CheckoutGateway {
  createSession(booking: CheckoutBooking): Promise<CheckoutSession>;
}

/** Lo que el checkout necesita saber de la reserva. Montos en CLP enteros. */
export interface CheckoutBooking {
  id: string;
  spaceName: string;
  subtotal: number;
  fee: number;
  total: number;
  /** Hasta cuándo se retiene el horario (P-06): la sesión de pago no debería durar más. */
  expiresAt: Date;
}

/** A dónde redirigir al arrendatario y, si el proveedor la tiene, el id de su sesión (se guarda en la reserva). */
export interface CheckoutSession {
  url: string;
  sessionId?: string;
}

/** Token de inyección de `CheckoutGateway` (las interfaces no existen en tiempo de ejecución). */
export const CHECKOUT_GATEWAY = Symbol('CHECKOUT_GATEWAY');
