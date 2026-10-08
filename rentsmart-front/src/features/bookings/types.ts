import type { Paginated, ScheduleRule } from '../catalog/types'

// Contrato de disponibilidad, reservas y pagos (F-05). Son los DTOs del back: ver /docs y docs/arquitectura.md.

/** Estados de una reserva (los mismos que el back). */
export type BookingStatus = 'PENDING' | 'PAID' | 'CONFIRMED' | 'FINISHED' | 'CANCELLED' | 'EXPIRED'

/** `HOUR` cobra el precio por hora por cada bloque; `DAY`, el precio por día por todo el horario de ese día. */
export type BookingUnit = 'HOUR' | 'DAY'

/** Un bloque libre de una hora, en UTC (ISO 8601). */
export interface AvailabilitySlot {
  startAt: string
  endAt: string
}

/** Lo que toma una reserva "por día": todo el horario de ese día. */
export interface FullDay {
  startAt: string
  endAt: string
  /** false si alguna hora del día ya está ocupada o ya pasó. */
  available: boolean
}

export interface AvailabilityDay {
  /** `AAAA-MM-DD`, en la hora de Chile. */
  date: string
  /** Bloques libres, en orden. Vacío si el día no se arrienda o está completo. */
  slots: AvailabilitySlot[]
  /** null si ese día no tiene horario. */
  fullDay: FullDay | null
}

/** GET /api/spaces/:id/availability?from=&to= (público). */
export interface Availability {
  spaceId: string
  timeZone: string
  days: AvailabilityDay[]
}

/** GET y PUT /api/spaces/:id/schedule: el horario semanal completo, en hora de Chile y horas cerradas. */
export interface Schedule {
  rules: ScheduleRule[]
}

/** POST /api/bookings. Las fechas salen de la disponibilidad: horas cerradas en UTC. */
export interface CreateBookingPayload {
  spaceId: string
  startAt: string
  endAt: string
  unit: BookingUnit
}

/** Respuesta de POST /api/bookings: el front redirige a `checkoutUrl` (Stripe Checkout). */
export interface BookingCheckout {
  bookingId: string
  checkoutUrl: string
}

/** El espacio de una reserva, como lo ve el arrendatario. */
export interface BookingSpace {
  id: string
  name: string
  communeName: string | null
  /** Dirección pública. */
  address: string | null
  /** Detalle privado (depto, oficina, indicaciones): solo en una reserva `CONFIRMED`. */
  addressDetail: string | null
  coverUrl: string | null
}

/** GET /api/bookings/:id y cada elemento de GET /api/bookings/me. */
export interface Booking {
  id: string
  status: BookingStatus
  unit: BookingUnit
  /** UTC (ISO 8601); se muestra en la hora de Chile. */
  startAt: string
  endAt: string
  /** CLP enteros: el precio del espacio por las horas o el día. */
  subtotal: number
  /** CLP enteros: comisión de la plataforma, sumada al arrendatario. */
  fee: number
  /** CLP enteros: lo que paga el arrendatario (subtotal + fee). */
  total: number
  /** Hasta cuándo se retiene el horario mientras se paga (30 min). Solo importa en `PENDING`. */
  expiresAt: string | null
  createdAt: string
  space: BookingSpace
}

export type BookingsPage = Paginated<Booking>

export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED'

/** Cada elemento de GET /api/payments/me. */
export interface Payment {
  id: string
  bookingId: string
  spaceName: string
  /** CLP enteros: lo que se cobró (el total de la reserva). */
  amount: number
  fee: number
  refundedAmount: number
  status: PaymentStatus
  createdAt: string
}

export type PaymentsPage = Paginated<Payment>
