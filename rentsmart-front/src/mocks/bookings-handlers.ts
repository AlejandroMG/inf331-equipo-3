import { http, HttpResponse } from 'msw'
import type {
  Availability,
  AvailabilityDay,
  Booking,
  BookingCheckout,
  BookingStatus,
  CreateBookingPayload,
  Payment,
  Schedule,
} from '../features/bookings/types'
import type { ScheduleRule } from '../features/catalog/types'
import { catalogData } from './catalog-data'

// Contrato de disponibilidad, reservas y pagos (F-05), simulado con las mismas formas y códigos que el back.
// Diferencias a propósito, para que las pruebas no dependan del reloj: las horas que ya pasaron siguen libres,
// una reserva pendiente no vence sola y solo se reserva dentro de un mismo día.

const TIME_ZONE = 'America/Santiago'
const HOUR = 3_600_000
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const HOUR_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:00:00(\.0{1,3})?Z$/
const START_TIME_PATTERN = /^([01]\d|2[0-3]):00$/
const END_TIME_PATTERN = /^(0[1-9]|1\d|2[0-4]):00$/
const MAX_DAYS = 31
/** Comisión supuesta mientras P-13 siga abierta: 10 % sumado al arrendatario. */
const FEE_PERCENT = 10
/** Los estados que ocupan el horario (P-06). */
const BLOCKING: BookingStatus[] = ['PENDING', 'PAID', 'CONFIRMED']
/** Un bloque siempre ocupado, para ver un día incompleto y probar el 409: los miércoles de 13:00 a 14:00. */
const BUSY = { weekday: 3, hour: 13 }
/** El mismo horario que el detalle simulado del catálogo: lunes a viernes de 09:00 a 21:00. */
const DEFAULT_RULES: ScheduleRule[] = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: '09:00', endTime: '21:00' }))

interface MockBooking extends Booking {
  /** Cuántas veces se consultó: así avanza de PENDING a PAID y a CONFIRMED. */
  polls: number
  paid: boolean
}

const bookings: MockBooking[] = []
const schedules = new Map<string, ScheduleRule[]>()

/** Vacía las reservas y los horarios simulados (los tests lo llaman entre pruebas). */
export function resetMockBookings() {
  bookings.length = 0
  schedules.clear()
}

const error = (status: number, error: string, message: string) =>
  HttpResponse.json({ statusCode: status, error, message }, { status })
const badRequest = (message: string) => error(400, 'Bad Request', message)
const notFound = (message: string) => error(404, 'Not Found', message)
const conflict = (message: string) => error(409, 'Conflict', message)
const unauthorized = () => error(401, 'Unauthorized', 'Inicia sesión para continuar.')
const hasSession = (request: Request) => request.headers.has('authorization')

/** Cuántos minutos va la hora de Chile respecto de UTC en ese instante (-180 en verano, -240 en invierno). */
function offsetMinutes(utcMs: number): number {
  const name =
    new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, timeZoneName: 'longOffset' })
      .formatToParts(new Date(utcMs))
      .find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name)
  if (!match) return 0
  const minutes = Number(match[2]) * 60 + Number(match[3])
  return match[1] === '-' ? -minutes : minutes
}

/** El instante UTC de una hora (0 a 24) de un día `AAAA-MM-DD` en Chile. */
function santiagoToUtc(date: string, hour: number): Date {
  const [year, month, day] = date.split('-').map(Number)
  const local = Date.UTC(year, month - 1, day, hour)
  const first = local - offsetMinutes(local) * 60_000
  return new Date(local - offsetMinutes(first) * 60_000)
}

/** El día `AAAA-MM-DD` en que cae un instante en Chile. */
const santiagoDate = (instant: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant)

const calendarDay = (date: string) => {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}
const hourOf = (time: string) => Number(time.slice(0, 2))

function rulesOf(spaceId: string): ScheduleRule[] {
  return schedules.get(spaceId) ?? (catalogData.some((space) => space.id === spaceId) ? DEFAULT_RULES : [])
}

function isTaken(spaceId: string, weekday: number, hour: number, startMs: number): boolean {
  if (weekday === BUSY.weekday && hour === BUSY.hour) return true
  return bookings.some(
    (booking) =>
      booking.space.id === spaceId &&
      BLOCKING.includes(booking.status) &&
      Date.parse(booking.startAt) <= startMs &&
      startMs < Date.parse(booking.endAt),
  )
}

/** Las horas del horario de un día, con las libres marcadas. */
function hoursOfDay(spaceId: string, date: string) {
  const weekday = calendarDay(date).getUTCDay()
  return rulesOf(spaceId)
    .filter((rule) => rule.weekday === weekday)
    .flatMap((rule) => Array.from({ length: hourOf(rule.endTime) - hourOf(rule.startTime) }, (_, i) => hourOf(rule.startTime) + i))
    .sort((a, b) => a - b)
    .map((hour) => {
      const startAt = santiagoToUtc(date, hour)
      return { startAt, endAt: santiagoToUtc(date, hour + 1), free: !isTaken(spaceId, weekday, hour, startAt.getTime()) }
    })
}

function dayOf(spaceId: string, date: string): AvailabilityDay {
  const hours = hoursOfDay(spaceId, date)
  const iso = (slot: { startAt: Date; endAt: Date }) => ({ startAt: slot.startAt.toISOString(), endAt: slot.endAt.toISOString() })
  return {
    date,
    slots: hours.filter((hour) => hour.free).map(iso),
    fullDay:
      hours.length === 0
        ? null
        : {
            startAt: hours[0].startAt.toISOString(),
            endAt: hours[hours.length - 1].endAt.toISOString(),
            available: hours.every((hour) => hour.free),
          },
  }
}

/** Reglas del horario semanal: horas cerradas, fin posterior al inicio y sin traslapes en un mismo día. */
function scheduleError(rules: unknown): string | null {
  if (!Array.isArray(rules)) return 'rules debe ser una lista'
  const list = rules as ScheduleRule[]
  for (const rule of list) {
    if (!Number.isInteger(rule.weekday) || rule.weekday < 0 || rule.weekday > 6) return 'weekday debe ir de 0 a 6'
    if (!START_TIME_PATTERN.test(rule.startTime) || !END_TIME_PATTERN.test(rule.endTime)) return 'Las horas deben ser cerradas (HH:00)'
    if (hourOf(rule.endTime) <= hourOf(rule.startTime)) return 'El fin debe ser posterior al inicio'
  }
  const overlap = list.some((a, i) =>
    list.some((b, j) => i < j && a.weekday === b.weekday && hourOf(a.startTime) < hourOf(b.endTime) && hourOf(b.startTime) < hourOf(a.endTime)),
  )
  return overlap ? 'Los rangos de un mismo día no pueden traslaparse' : null
}

const sortRules = (rules: ScheduleRule[]) =>
  [...rules].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime))

/** La reserva como la entrega la API: el detalle de la dirección solo si está confirmada (P-09). */
function toBooking(mock: MockBooking): Booking {
  const { id, status, unit, startAt, endAt, subtotal, fee, total, expiresAt, createdAt } = mock
  const booking = { id, status, unit, startAt, endAt, subtotal, fee, total, expiresAt, createdAt, space: mock.space }
  return {
    ...booking,
    space: { ...booking.space, addressDetail: booking.status === 'CONFIRMED' ? 'Oficina 502. Citófono 12, preguntar por recepción.' : null },
  }
}

function paymentOf(booking: MockBooking): Payment {
  const refunded = booking.status === 'CANCELLED'
  return {
    id: `payment-${booking.id}`,
    bookingId: booking.id,
    spaceName: booking.space.name,
    amount: booking.total,
    fee: booking.fee,
    refundedAmount: refunded ? booking.total : 0,
    status: refunded ? 'REFUNDED' : 'SUCCEEDED',
    createdAt: booking.createdAt,
  }
}

function pageOf<T>(request: Request, all: T[]) {
  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
  const pageSize = Math.max(1, Number(url.searchParams.get('pageSize')) || 20)
  const start = (page - 1) * pageSize
  return { items: all.slice(start, start + pageSize), total: all.length, page, pageSize }
}

export const bookingHandlers = [
  // DI-02: bloques libres de un espacio entre dos días (público).
  http.get('*/api/spaces/:id/availability', ({ params, request }) => {
    const spaceId = String(params.id)
    const url = new URL(request.url)
    const from = url.searchParams.get('from') ?? ''
    const to = url.searchParams.get('to') ?? ''
    if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) return badRequest('from y to deben ser fechas AAAA-MM-DD')
    const count = (calendarDay(to).getTime() - calendarDay(from).getTime()) / (24 * HOUR) + 1
    if (count < 1) return badRequest('from no puede ser posterior a to')
    if (count > MAX_DAYS) return badRequest(`Se pueden pedir hasta ${MAX_DAYS} días`)
    if (!catalogData.some((space) => space.id === spaceId)) return notFound('El espacio no existe')

    const days = Array.from({ length: count }, (_, i) =>
      dayOf(spaceId, new Date(calendarDay(from).getTime() + i * 24 * HOUR).toISOString().slice(0, 10)),
    )
    return HttpResponse.json({ spaceId, timeZone: TIME_ZONE, days } satisfies Availability)
  }),

  // DI-01: horario semanal del propietario. Cualquier id sirve: los espacios propios viven en handlers.ts.
  http.get('*/api/spaces/:id/schedule', ({ params, request }) => {
    if (!hasSession(request)) return unauthorized()
    return HttpResponse.json({ rules: sortRules(rulesOf(String(params.id))) } satisfies Schedule)
  }),
  http.put('*/api/spaces/:id/schedule', async ({ params, request }) => {
    if (!hasSession(request)) return unauthorized()
    const { rules } = (await request.json()) as Schedule
    const invalid = scheduleError(rules)
    if (invalid) return badRequest(invalid)
    const sorted = sortRules(rules.map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime })))
    schedules.set(String(params.id), sorted)
    return HttpResponse.json({ rules: sorted } satisfies Schedule)
  }),

  // RE-02 y PA-01: reservar. Queda PENDING y entrega a dónde ir a pagar; aquí, directo a la pantalla de retorno.
  http.post('*/api/bookings', async ({ request }) => {
    if (!hasSession(request)) return unauthorized()
    const payload = (await request.json()) as CreateBookingPayload
    if (!HOUR_UTC_PATTERN.test(payload.startAt ?? '') || !HOUR_UTC_PATTERN.test(payload.endAt ?? '')) {
      return badRequest('startAt y endAt deben ser horas cerradas en UTC')
    }
    const start = new Date(payload.startAt)
    const end = new Date(payload.endAt)
    if (end <= start) return badRequest('El fin debe ser posterior al inicio')
    if (payload.unit !== 'HOUR' && payload.unit !== 'DAY') return badRequest('unit debe ser HOUR o DAY')
    const space = catalogData.find((item) => item.id === payload.spaceId)
    if (!space) return notFound('El espacio no existe')
    const price = payload.unit === 'DAY' ? space.pricePerDay : space.pricePerHour
    if (price === null) return badRequest(payload.unit === 'DAY' ? 'Este espacio no se arrienda por día' : 'Este espacio no se arrienda por hora')

    const hours = hoursOfDay(space.id, santiagoDate(start))
    const wanted = hours.filter((hour) => hour.startAt >= start && hour.endAt <= end)
    if (payload.unit === 'DAY') {
      // El día completo puede tener pausas (09:00 a 13:00 y 15:00 a 19:00): va del primer inicio al último fin.
      const isFullDay = hours.length > 0 && +hours[0].startAt === +start && +hours[hours.length - 1].endAt === +end
      if (!isFullDay) return badRequest('Una reserva por día toma el horario completo de ese día')
    } else if (wanted.length !== (end.getTime() - start.getTime()) / HOUR) {
      return conflict('El horario está fuera del horario del espacio')
    }
    if (wanted.some((hour) => !hour.free)) return conflict('Ese horario ya está reservado')

    const subtotal = payload.unit === 'DAY' ? price : price * wanted.length
    const fee = Math.round((subtotal * FEE_PERCENT) / 100)
    const now = Date.now()
    const booking: MockBooking = {
      id: `booking-${bookings.length + 1}`,
      status: 'PENDING',
      unit: payload.unit,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      subtotal,
      fee,
      total: subtotal + fee,
      expiresAt: new Date(now + 30 * 60_000).toISOString(),
      createdAt: new Date(now).toISOString(),
      space: { id: space.id, name: space.name, communeName: space.communeName, address: 'Av. Libertador Bernardo O’Higgins 1234', addressDetail: null, coverUrl: space.coverUrl },
      polls: 0,
      paid: false,
    }
    bookings.push(booking)
    const origin = typeof location === 'undefined' ? '' : location.origin
    return HttpResponse.json(
      { bookingId: booking.id, checkoutUrl: `${origin}/bookings/${booking.id}/success` } satisfies BookingCheckout,
      { status: 201 },
    )
  }),

  // Mis reservas, las más recientes primero. Va antes que ':id' para que "me" no se tome por un id.
  http.get('*/api/bookings/me', ({ request }) => {
    if (!hasSession(request)) return unauthorized()
    return HttpResponse.json(pageOf(request, [...bookings].reverse().map(toBooking)))
  }),

  // Una reserva. Simula el pago y la confirmación: la primera consulta la ve PENDING, la segunda PAID y la tercera
  // CONFIRMED, como cuando el front espera al webhook después de volver de Stripe.
  http.get('*/api/bookings/:id', ({ params, request }) => {
    if (!hasSession(request)) return unauthorized()
    const booking = bookings.find((item) => item.id === params.id)
    if (!booking) return notFound('La reserva no existe')
    booking.polls += 1
    if (booking.status === 'PAID') booking.status = 'CONFIRMED'
    else if (booking.status === 'PENDING' && booking.polls >= 2) {
      booking.status = 'PAID'
      booking.paid = true
    }
    return HttpResponse.json(toBooking(booking))
  }),

  // RE-05 (fuera del MVP): cancelar. Libera el horario; si ya estaba pagada, el pago queda reembolsado.
  http.post('*/api/bookings/:id/cancel', ({ params, request }) => {
    if (!hasSession(request)) return unauthorized()
    const booking = bookings.find((item) => item.id === params.id)
    if (!booking) return notFound('La reserva no existe')
    if (!BLOCKING.includes(booking.status)) return conflict('La reserva ya no se puede cancelar')
    booking.status = 'CANCELLED'
    return HttpResponse.json(toBooking(booking))
  }),

  // Mis pagos (panel del arrendatario): uno por cada reserva que llegó a pagarse.
  http.get('*/api/payments/me', ({ request }) => {
    if (!hasSession(request)) return unauthorized()
    return HttpResponse.json(pageOf(request, [...bookings].reverse().filter((booking) => booking.paid).map(paymentOf)))
  }),
]
