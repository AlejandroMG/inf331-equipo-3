import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetMockBookings } from '../../mocks/bookings-handlers'
import { server } from '../../mocks/server'
import { setToken } from '../../lib/token'
import { createBooking, getAvailability, getBooking } from './bookings-api'

// Contra el mock de MSW (src/mocks/bookings-handlers.ts), que responde con la misma forma que el back.
// El lunes 12 de octubre de 2026 Chile está en UTC-3: las 09:00 son las 12:00 UTC.
const SPACE = 'seed-space-1'

describe('getAvailability', () => {
  it('trae un día por fecha pedida, con los bloques libres en UTC y el día completo', async () => {
    const { spaceId, timeZone, days } = await getAvailability(SPACE, '2026-10-11', '2026-10-12')

    expect(spaceId).toBe(SPACE)
    expect(timeZone).toBe('America/Santiago')
    expect(days.map((day) => day.date)).toEqual(['2026-10-11', '2026-10-12'])
    expect(days[0]).toEqual({ date: '2026-10-11', slots: [], fullDay: null })
    expect(days[1].slots[0]).toEqual({ startAt: '2026-10-12T12:00:00.000Z', endAt: '2026-10-12T13:00:00.000Z' })
    expect(days[1].fullDay).toEqual({ startAt: '2026-10-12T12:00:00.000Z', endAt: '2026-10-13T00:00:00.000Z', available: true })
  })

  it('manda from y to en la query y codifica el id del espacio', async () => {
    let url: URL | undefined
    server.use(
      http.get('*/api/spaces/:id/availability', ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({ spaceId: 'a/b', timeZone: 'America/Santiago', days: [] })
      }),
    )

    await getAvailability('a/b', '2026-10-12', '2026-10-18')

    expect(url?.pathname).toBe('/api/spaces/a%2Fb/availability')
    expect(url?.searchParams.get('from')).toBe('2026-10-12')
    expect(url?.searchParams.get('to')).toBe('2026-10-18')
  })

  it('rechaza con el código de la API: 400 por el rango y 404 si el espacio no existe', async () => {
    await expect(getAvailability(SPACE, '2026-10-13', '2026-10-12')).rejects.toMatchObject({ status: 400 })
    await expect(getAvailability(SPACE, '2026-10-01', '2026-11-01')).rejects.toMatchObject({ status: 400 })
    await expect(getAvailability('no-existe', '2026-10-12', '2026-10-12')).rejects.toMatchObject({ status: 404 })
  })

  it('se puede cancelar con un AbortSignal', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(getAvailability(SPACE, '2026-10-12', '2026-10-12', controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
  })
})

// Lunes 12 de octubre de 2026, de 10:00 a 12:00 en Chile.
const MONDAY_10_TO_12 = { startAt: '2026-10-12T13:00:00.000Z', endAt: '2026-10-12T15:00:00.000Z' }

describe('createBooking y getBooking', () => {
  beforeEach(() => setToken('token-de-prueba'))
  afterEach(() => resetMockBookings())

  it('crea la reserva y entrega a dónde ir a pagar; getBooking la trae con el desglose', async () => {
    const { bookingId, checkoutUrl } = await createBooking({ spaceId: SPACE, ...MONDAY_10_TO_12, unit: 'HOUR' })

    expect(checkoutUrl).toMatch(new RegExp(`/bookings/${bookingId}$`))
    const booking = await getBooking(bookingId)
    expect(booking).toMatchObject({ id: bookingId, status: 'PENDING', unit: 'HOUR', subtotal: 24000, fee: 2400, total: 26400 })
    expect(booking.space.id).toBe(SPACE)
  })

  it('manda solo los campos del contrato, nunca montos', async () => {
    let body: unknown
    server.use(
      http.post('*/api/bookings', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ bookingId: 'b1', checkoutUrl: 'https://pago.test/b1' }, { status: 201 })
      }),
    )
    const payload = { spaceId: SPACE, ...MONDAY_10_TO_12, unit: 'DAY' as const, total: 1 }

    await createBooking(payload)

    expect(body).toEqual({ spaceId: SPACE, ...MONDAY_10_TO_12, unit: 'DAY' })
  })

  it('rechaza con el código y el mensaje del back: 409 si el horario está ocupado, 404 si la reserva no existe', async () => {
    await createBooking({ spaceId: SPACE, ...MONDAY_10_TO_12, unit: 'HOUR' })

    await expect(createBooking({ spaceId: SPACE, ...MONDAY_10_TO_12, unit: 'HOUR' })).rejects.toMatchObject({
      status: 409,
      message: 'Ese horario ya está reservado',
    })
    await expect(getBooking('no-existe')).rejects.toMatchObject({ status: 404 })
  })

  it('getBooking codifica el id', async () => {
    let path: string | undefined
    server.use(
      http.get('*/api/bookings/:id', ({ request }) => {
        path = new URL(request.url).pathname
        return HttpResponse.json({})
      }),
    )

    await getBooking('a/b')

    expect(path).toBe('/api/bookings/a%2Fb')
  })
})
