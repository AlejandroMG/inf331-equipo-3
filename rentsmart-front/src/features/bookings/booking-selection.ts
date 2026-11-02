import { paths } from '../../lib/paths'
import type { AvailabilitySlot, BookingStatus, BookingUnit } from './types'

/** Cómo se muestra cada estado de una reserva. */
export const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: 'Pendiente de pago',
  PAID: 'Pagada',
  CONFIRMED: 'Confirmada',
  FINISHED: 'Finalizada',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Expirada',
}

/** Las fechas viven en UTC en el servidor y se muestran en la hora de Chile. */
export const TIME_ZONE = 'America/Santiago'

/**
 * Comisión de la plataforma (P-13): 10 % sumado al arrendatario. El back es quien cobra (`FEE_PERCENT` en
 * `rentsmart-back/src/bookings/pricing.ts`); aquí solo se usa para mostrar el desglose antes de reservar.
 */
export const FEE_PERCENT = 10

/** Cuántos días hacia adelante ofrece el widget para reservar, contando hoy. */
export const BOOKING_WINDOW_DAYS = 14

export interface Amounts {
  subtotal: number
  fee: number
  total: number
}

/** El mismo cálculo que el back: por hora, el precio por cada bloque; por día, el precio por día. */
export function estimateAmounts(price: number, unit: BookingUnit, hours: number): Amounts {
  const subtotal = unit === 'DAY' ? price : price * hours
  const fee = Math.round((subtotal * FEE_PERCENT) / 100)
  return { subtotal, fee, total: subtotal + fee }
}

/** Un rango de bloques elegidos, como índices (ambos incluidos) en la lista de bloques libres del día. */
export interface SlotRange {
  from: number
  to: number
}

/** Si los bloques de `from` a `to` van seguidos, sin una hora ocupada o una pausa entre medio. */
export function isContiguous(slots: AvailabilitySlot[], from: number, to: number): boolean {
  for (let i = from; i < to; i += 1) {
    if (slots[i].endAt !== slots[i + 1].startAt) return false
  }
  return true
}

/**
 * La selección después de tocar el bloque `index`. El primer toque elige un bloque; tocar uno posterior alarga
 * la reserva hasta él si los bloques van seguidos; tocar el único elegido lo quita. Cualquier otro toque empieza
 * una selección nueva en ese bloque.
 */
export function toggleSlot(slots: AvailabilitySlot[], range: SlotRange | null, index: number): SlotRange | null {
  if (!range) return { from: index, to: index }
  if (range.from === index && range.to === index) return null
  if (index > range.from && isContiguous(slots, range.from, index)) return { from: range.from, to: index }
  return { from: index, to: index }
}

const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
const dayLabelFormat = new Intl.DateTimeFormat('es-CL', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
const shortDayFormat = new Intl.DateTimeFormat('es-CL', { timeZone: TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short' })
const timeFormat = new Intl.DateTimeFormat('es-CL', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** El día de hoy en Chile como `AAAA-MM-DD`. */
export const todayInSantiago = (now: Date = new Date()) => dateFormat.format(now)

/** El día `AAAA-MM-DD` que viene `days` días después. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/** "lunes, 12 de octubre" para `2026-10-12` (un día del calendario, sin hora). */
export function formatDayLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const label = dayLabelFormat.format(new Date(Date.UTC(year, month - 1, day)))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** "10:00": la hora de Chile de un instante UTC. */
export const formatTime = (iso: string) => timeFormat.format(new Date(iso))

/** "lun 12 oct · 10:00 a 12:00"; si cruza la medianoche, lleva los dos días. */
export function formatRange(startAt: string, endAt: string): string {
  const startDay = shortDayFormat.format(new Date(startAt))
  const endDay = shortDayFormat.format(new Date(endAt))
  // Un rango que termina a las 24:00 termina el día siguiente a las 00:00, pero se lee como del mismo día.
  const endsAtMidnight = formatTime(endAt) === '00:00' && new Date(endAt).getTime() - new Date(startAt).getTime() <= 86_400_000
  if (startDay === endDay || endsAtMidnight) {
    return `${startDay} · ${formatTime(startAt)} a ${endsAtMidnight ? '24:00' : formatTime(endAt)}`
  }
  return `${startDay} ${formatTime(startAt)} a ${endDay} ${formatTime(endAt)}`
}

/** Horas enteras entre dos instantes. */
export const hoursBetween = (startAt: string, endAt: string) => Math.round((Date.parse(endAt) - Date.parse(startAt)) / 3_600_000)

/** A dónde ir después de reservar: una ruta de la app o un sitio externo (el checkout de Stripe). */
export type CheckoutDestination = { inApp: true; path: string } | { inApp: false; url: string }

/**
 * Decide a dónde lleva `checkoutUrl`. Si es del mismo origen que la app, o su ruta es `/bookings/<id>` (el checkout
 * sin Stripe, que arma el back con `FRONTEND_URL`), se queda en la app y va a la página de la reserva: así no
 * depende de que `FRONTEND_URL` sea exactamente el origen del front (otro puerto, `127.0.0.1` en vez de `localhost`).
 * Conserva el query string (el mock de MSW vuelve con `?pago=ok`, como Stripe). Cualquier otra URL (Stripe Checkout,
 * PA-01) es externa.
 */
export function checkoutDestination(checkoutUrl: string, bookingId: string, origin: string): CheckoutDestination {
  const target = new URL(checkoutUrl, origin)
  if (target.origin === origin || /^\/bookings\/[^/]+\/?$/.test(target.pathname)) {
    return { inApp: true, path: `${paths.booking(bookingId)}${target.search}` }
  }
  return { inApp: false, url: target.href }
}

/** Cuánto falta para `expiresAt`, como "29:05", o null si ya venció. */
export function remainingLabel(expiresAt: string, now: Date): string | null {
  const ms = Date.parse(expiresAt) - now.getTime()
  if (ms <= 0) return null
  const seconds = Math.ceil(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
