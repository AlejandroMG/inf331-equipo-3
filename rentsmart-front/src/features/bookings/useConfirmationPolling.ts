import { useEffect, useState } from 'react'
import { getBooking } from './bookings-api'
import type { Booking, BookingStatus } from './types'

/** Cada cuánto se consulta la reserva después de volver de Stripe con `?pago=ok` (PA-01). */
export const POLL_INTERVAL_MS = 2000
/** Cuántas consultas se hacen como máximo (un minuto en total). Después queda el botón «Actualizar el estado». */
export const POLL_MAX_ATTEMPTS = 30

/** Mientras la reserva esté en uno de estos estados, el pago todavía no termina de confirmarse. */
const AWAITING: BookingStatus[] = ['PENDING', 'PAID']

/**
 * Después de pagar, Stripe devuelve a `/bookings/<id>?pago=ok` antes de que el webhook confirme la reserva (PA-02,
 * RE-04). Si `enabled`, consulta la reserva cada `POLL_INTERVAL_MS`, hasta `POLL_MAX_ATTEMPTS` veces, mientras siga
 * `PENDING` o `PAID`; se detiene al ver `CONFIRMED` u otro estado final. Cada consulta se programa al terminar la
 * anterior, así nunca hay dos a la vez, y el temporizador y la petición en curso se cancelan al desmontar.
 *
 * Devuelve la reserva más reciente, si sigue consultando (`polling`) y si se agotaron los intentos (`exhausted`).
 */
export function useConfirmationPolling(initial: Booking, enabled: boolean) {
  const [booking, setBooking] = useState(initial)
  const [attempts, setAttempts] = useState(0)
  const awaiting = enabled && AWAITING.includes(booking.status)
  const exhausted = awaiting && attempts >= POLL_MAX_ATTEMPTS
  const polling = awaiting && !exhausted

  useEffect(() => {
    if (!polling) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      getBooking(initial.id, controller.signal)
        .then((latest) => {
          setBooking(latest)
          setAttempts((n) => n + 1)
        })
        .catch(() => {
          // Un error de red cuenta como un intento; la próxima consulta lo vuelve a probar.
          if (!controller.signal.aborted) setAttempts((n) => n + 1)
        })
    }, POLL_INTERVAL_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [polling, attempts, initial.id])

  return { booking, polling, exhausted }
}
