import { beforeEach, describe, expect, it } from 'vitest'
import type { Availability, Booking, BookingCheckout, BookingsPage, PaymentsPage, Schedule } from '../features/bookings/types'
import { http } from '../lib/http'
import { clearToken, setToken } from '../lib/token'

// F-05: el contrato de disponibilidad, reservas y pagos, simulado con MSW. El cliente real llama a la API y
// recibe las respuestas de bookings-handlers.ts sin que exista el back.

// El lunes 12 de octubre de 2026 Chile está en UTC-3: las 09:00 son las 12:00 UTC.
const SPACE = 'seed-space-1' // 12.000 por hora, no se arrienda por día
const DAY_SPACE = 'seed-space-2' // 18.000 por hora y 120.000 por día
const MONDAY_10_TO_12 = { spaceId: SPACE, startAt: '2026-10-12T13:00:00.000Z', endAt: '2026-10-12T15:00:00.000Z', unit: 'HOUR' as const }

const availability = (from: string, to: string, spaceId = SPACE) =>
  http.get<Availability>(`/spaces/${spaceId}/availability`, { params: { from, to } })
const book = (payload: object = MONDAY_10_TO_12) => http.post<BookingCheckout>('/bookings', payload)
const booking = (id: string) => http.get<Booking>(`/bookings/${id}`)

beforeEach(() => setToken('mock-token'))

describe('disponibilidad simulada', () => {
  it('es pública y trae los bloques libres de cada día en UTC', async () => {
    clearToken()

    const { spaceId, timeZone, days } = await availability('2026-10-11', '2026-10-12')

    expect(spaceId).toBe(SPACE)
    expect(timeZone).toBe('America/Santiago')
    expect(days.map((day) => day.date)).toEqual(['2026-10-11', '2026-10-12'])
    // El domingo no se arrienda.
    expect(days[0]).toEqual({ date: '2026-10-11', slots: [], fullDay: null })
    expect(days[1].slots).toHaveLength(12)
    expect(days[1].slots[0]).toEqual({ startAt: '2026-10-12T12:00:00.000Z', endAt: '2026-10-12T13:00:00.000Z' })
    expect(days[1].fullDay).toEqual({ startAt: '2026-10-12T12:00:00.000Z', endAt: '2026-10-13T00:00:00.000Z', available: true })
  })

  it('en invierno (UTC-4) las mismas 09:00 son las 13:00 UTC', async () => {
    const { days } = await availability('2026-07-01', '2026-07-01')

    expect(days[0].slots[0].startAt).toBe('2026-07-01T13:00:00.000Z')
  })

  it('un día con una hora ocupada no se puede tomar completo', async () => {
    const { days } = await availability('2026-10-14', '2026-10-14')

    expect(days[0].slots).toHaveLength(11)
    expect(days[0].slots.map((slot) => slot.startAt)).not.toContain('2026-10-14T16:00:00.000Z')
    expect(days[0].fullDay?.available).toBe(false)
  })

  it('responde 400 sin fechas, con el rango al revés o de más de 31 días, y 404 si el espacio no existe', async () => {
    await expect(http.get(`/spaces/${SPACE}/availability`)).rejects.toMatchObject({ status: 400 })
    await expect(availability('2026-10-13', '2026-10-12')).rejects.toMatchObject({ status: 400 })
    await expect(availability('2026-10-01', '2026-11-01')).rejects.toMatchObject({ status: 400 })
    await expect(availability('2026-10-12', '2026-10-12', 'no-existe')).rejects.toMatchObject({ status: 404 })
  })
})

describe('horario semanal simulado', () => {
  it('pide sesión', async () => {
    clearToken()

    await expect(http.get(`/spaces/${SPACE}/schedule`)).rejects.toMatchObject({ status: 401 })
    await expect(http.put(`/spaces/${SPACE}/schedule`, { rules: [] })).rejects.toMatchObject({ status: 401 })
  })

  it('reemplaza el horario, lo devuelve ordenado y la disponibilidad lo refleja', async () => {
    const rules = [
      { weekday: 1, startTime: '15:00', endTime: '17:00' },
      { weekday: 0, startTime: '10:00', endTime: '24:00' },
      { weekday: 1, startTime: '09:00', endTime: '11:00' },
    ]

    const saved = await http.put<Schedule>(`/spaces/${SPACE}/schedule`, { rules })

    expect(saved.rules).toEqual([rules[1], rules[2], rules[0]])
    expect(await http.get<Schedule>(`/spaces/${SPACE}/schedule`)).toEqual(saved)
    const { days } = await availability('2026-10-11', '2026-10-13')
    expect(days.map((day) => day.slots.length)).toEqual([14, 4, 0])
    // El día completo va del primer inicio al último fin, con la pausa incluida.
    expect(days[1].fullDay).toEqual({ startAt: '2026-10-12T12:00:00.000Z', endAt: '2026-10-12T20:00:00.000Z', available: true })
    // Hasta las 24:00 del domingo: la medianoche del lunes en Chile.
    expect(days[0].fullDay?.endAt).toBe('2026-10-12T03:00:00.000Z')
  })

  it('un espacio propio que no está en el catálogo parte sin horario', async () => {
    expect(await http.get<Schedule>('/spaces/draft-1/schedule')).toEqual({ rules: [] })
  })

  it.each([
    ['un día que no existe', [{ weekday: 7, startTime: '09:00', endTime: '10:00' }]],
    ['una hora que no es cerrada', [{ weekday: 1, startTime: '09:30', endTime: '10:00' }]],
    ['un fin anterior al inicio', [{ weekday: 1, startTime: '12:00', endTime: '10:00' }]],
    ['rangos traslapados', [{ weekday: 1, startTime: '09:00', endTime: '12:00' }, { weekday: 1, startTime: '11:00', endTime: '13:00' }]],
  ])('responde 400 con %s', async (_name, rules) => {
    await expect(http.put(`/spaces/${SPACE}/schedule`, { rules })).rejects.toMatchObject({ status: 400 })
  })
})

describe('reservas simuladas', () => {
  it('reservar pide sesión', async () => {
    clearToken()

    await expect(book()).rejects.toMatchObject({ status: 401 })
  })

  it('crea la reserva pendiente, con el desglose y a dónde ir a pagar', async () => {
    const { bookingId, checkoutUrl } = await book()

    expect(checkoutUrl).toContain(`/bookings/${bookingId}/success`)
    expect(await booking(bookingId)).toEqual({
      id: bookingId,
      status: 'PENDING',
      unit: 'HOUR',
      startAt: MONDAY_10_TO_12.startAt,
      endAt: MONDAY_10_TO_12.endAt,
      subtotal: 24000,
      fee: 2400,
      total: 26400,
      expiresAt: expect.any(String),
      createdAt: expect.any(String),
      space: { id: SPACE, name: 'Sala Alameda', communeName: 'Santiago', address: expect.any(String), addressDetail: null, coverUrl: null },
    })
  })

  it('la reserva pendiente retiene el horario: deja de estar libre y reservarlo de nuevo da 409', async () => {
    await book()

    const { days } = await availability('2026-10-12', '2026-10-12')
    expect(days[0].slots).toHaveLength(10)
    expect(days[0].fullDay?.available).toBe(false)
    await expect(book()).rejects.toMatchObject({ status: 409, message: 'Ese horario ya está reservado' })
    // Basta con que se cruce una hora.
    await expect(book({ ...MONDAY_10_TO_12, startAt: '2026-10-12T14:00:00.000Z', endAt: '2026-10-12T16:00:00.000Z' })).rejects.toMatchObject({ status: 409 })
  })

  it('responde 409 fuera del horario del espacio y sobre el bloque ocupado de los miércoles', async () => {
    await expect(book({ ...MONDAY_10_TO_12, startAt: '2026-10-12T10:00:00.000Z', endAt: '2026-10-12T12:00:00.000Z' })).rejects.toMatchObject({ status: 409 })
    await expect(book({ ...MONDAY_10_TO_12, startAt: '2026-10-11T13:00:00.000Z', endAt: '2026-10-11T14:00:00.000Z' })).rejects.toMatchObject({ status: 409 })
    await expect(book({ ...MONDAY_10_TO_12, startAt: '2026-10-14T16:00:00.000Z', endAt: '2026-10-14T17:00:00.000Z' })).rejects.toMatchObject({ status: 409 })
  })

  it('responde 400 con fechas que no son horas cerradas en UTC o con el fin antes del inicio, y 404 sin el espacio', async () => {
    await expect(book({ ...MONDAY_10_TO_12, startAt: '2026-10-12T13:30:00.000Z' })).rejects.toMatchObject({ status: 400 })
    await expect(book({ ...MONDAY_10_TO_12, endAt: '2026-10-12T12:00:00-03:00' })).rejects.toMatchObject({ status: 400 })
    await expect(book({ ...MONDAY_10_TO_12, endAt: MONDAY_10_TO_12.startAt })).rejects.toMatchObject({ status: 400 })
    await expect(book({ ...MONDAY_10_TO_12, spaceId: 'no-existe' })).rejects.toMatchObject({ status: 404 })
  })

  it('por día cobra el precio del día y exige el horario completo', async () => {
    const { days } = await availability('2026-10-12', '2026-10-12', DAY_SPACE)
    const { startAt, endAt } = days[0].fullDay!

    const { bookingId } = await book({ spaceId: DAY_SPACE, startAt, endAt, unit: 'DAY' })

    expect(await booking(bookingId)).toMatchObject({ unit: 'DAY', subtotal: 120000, fee: 12000, total: 132000 })
    await expect(book({ spaceId: DAY_SPACE, startAt: '2026-10-13T12:00:00.000Z', endAt: '2026-10-13T15:00:00.000Z', unit: 'DAY' })).rejects.toMatchObject({ status: 400 })
    // Este espacio solo se arrienda por hora.
    await expect(book({ spaceId: SPACE, startAt: '2026-10-13T12:00:00.000Z', endAt: '2026-10-14T00:00:00.000Z', unit: 'DAY' })).rejects.toMatchObject({ status: 400 })
  })

  it('después de pagar pasa de PENDING a PAID y a CONFIRMED, y recién confirmada trae el detalle de la dirección', async () => {
    const { bookingId } = await book()

    const seen = [await booking(bookingId), await booking(bookingId), await booking(bookingId), await booking(bookingId)]

    expect(seen.map((item) => item.status)).toEqual(['PENDING', 'PAID', 'CONFIRMED', 'CONFIRMED'])
    expect(seen.map((item) => item.space.addressDetail)).toEqual([null, null, expect.any(String), expect.any(String)])
  })

  it('lista mis reservas paginadas, la más reciente primero, y "me" no se toma por un id', async () => {
    expect(await http.get<BookingsPage>('/bookings/me')).toEqual({ items: [], total: 0, page: 1, pageSize: 20 })
    const first = await book()
    const second = await book({ ...MONDAY_10_TO_12, startAt: '2026-10-13T13:00:00.000Z', endAt: '2026-10-13T14:00:00.000Z' })

    const page = await http.get<BookingsPage>('/bookings/me', { params: { page: 1, pageSize: 1 } })

    expect(page).toMatchObject({ total: 2, page: 1, pageSize: 1 })
    expect(page.items.map((item) => item.id)).toEqual([second.bookingId])
    const next = await http.get<BookingsPage>('/bookings/me', { params: { page: 2, pageSize: 1 } })
    expect(next.items.map((item) => item.id)).toEqual([first.bookingId])
  })

  it('una reserva que no existe responde 404', async () => {
    await expect(booking('no-existe')).rejects.toMatchObject({ status: 404 })
    await expect(http.post('/bookings/no-existe/cancel')).rejects.toMatchObject({ status: 404 })
  })

  it('cancelar libera el horario y no se puede repetir (409)', async () => {
    const { bookingId } = await book()

    const cancelled = await http.post<Booking>(`/bookings/${bookingId}/cancel`)

    expect(cancelled.status).toBe('CANCELLED')
    expect((await availability('2026-10-12', '2026-10-12')).days[0].slots).toHaveLength(12)
    await expect(http.post(`/bookings/${bookingId}/cancel`)).rejects.toMatchObject({ status: 409 })
  })
})

describe('pagos simulados', () => {
  it('pide sesión', async () => {
    clearToken()

    await expect(http.get('/payments/me')).rejects.toMatchObject({ status: 401 })
  })

  it('lista un pago por cada reserva pagada, y lo marca reembolsado si se cancela', async () => {
    const { bookingId } = await book()
    expect((await http.get<PaymentsPage>('/payments/me')).items).toEqual([])

    await booking(bookingId)
    await booking(bookingId)

    const paid = await http.get<PaymentsPage>('/payments/me')
    expect(paid).toMatchObject({ total: 1, page: 1, pageSize: 20 })
    expect(paid.items[0]).toEqual({
      id: expect.any(String),
      bookingId,
      spaceName: 'Sala Alameda',
      amount: 26400,
      fee: 2400,
      refundedAmount: 0,
      status: 'SUCCEEDED',
      createdAt: expect.any(String),
    })
    await http.post(`/bookings/${bookingId}/cancel`)
    expect((await http.get<PaymentsPage>('/payments/me')).items[0]).toMatchObject({ status: 'REFUNDED', refundedAmount: 26400 })
  })
})
