/**
 * Puerto para reembolsar el pago de una reserva. Actualiza `Payment.refundedAmount` y `Payment.status`. Es idempotente:
 * si el pago ya está reembolsado, no hace nada. Lanza un error si el proveedor falla; quien llama decide qué hacer.
 */
export interface PaymentRefunder {
  refundBooking(bookingId: string, amount: number, reason: string): Promise<void>;
}

/** Token de inyección de `PaymentRefunder` (las interfaces no existen en tiempo de ejecución). */
export const PAYMENT_REFUNDER = Symbol('PAYMENT_REFUNDER');
