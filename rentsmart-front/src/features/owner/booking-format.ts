import type { BookingStatus } from './types'

/** Las fechas viven en UTC en el servidor y se muestran en la hora de Chile. */
const TIME_ZONE = 'America/Santiago'

export const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: 'Pendiente',
  PAID: 'Pagada',
  CONFIRMED: 'Confirmada',
  FINISHED: 'Finalizada',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Expirada',
}

/** El día de hoy en Chile como `AAAA-MM-DD`. */
export function todayInSantiago(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** El mes en que estamos en Chile, como `AAAA-MM`. */
export const currentMonthInSantiago = (now: Date = new Date()) => todayInSantiago(now).slice(0, 7)

const dayFormat = new Intl.DateTimeFormat('es-CL', { timeZone: TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short' })
const timeFormat = new Intl.DateTimeFormat('es-CL', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** "lun 5 oct · 13:00 a 16:00"; si cruza la medianoche, lleva los dos días. */
export function formatBookingRange(startAt: string, endAt: string): string {
  const start = new Date(startAt)
  const end = new Date(endAt)
  const startDay = dayFormat.format(start)
  const endDay = dayFormat.format(end)
  if (startDay === endDay) return `${startDay} · ${timeFormat.format(start)} a ${timeFormat.format(end)}`
  return `${startDay} ${timeFormat.format(start)} a ${endDay} ${timeFormat.format(end)}`
}

/** "octubre de 2026" para `2026-10`. */
export function monthLabel(month: string): string {
  const [year, number] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('es-CL', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(Date.UTC(year, number - 1, 1)))
}

/** El mes `delta` meses antes (negativo) o después de `month`, como `AAAA-MM`. */
export function shiftMonth(month: string, delta: number): string {
  const [year, number] = month.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, number - 1 + delta, 1))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`
}

export const MONTH_PATTERN = /^20\d{2}-(0[1-9]|1[0-2])$/
export const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

/** Horas con coma decimal solo si hacen falta: 6 → "6", 1.5 → "1,5". */
export const formatHours = (hours: number) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 }).format(hours)

/** 0.088 → "9 %". */
export const formatPercent = (ratio: number) => `${Math.round(ratio * 100)} %`
