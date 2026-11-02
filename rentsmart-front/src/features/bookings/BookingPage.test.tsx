import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setToken } from '../../lib/token'
import { server } from '../../mocks/server'
import { BookingPage } from './BookingPage'
import type { Booking, BookingStatus } from './types'
import { POLL_INTERVAL_MS, POLL_MAX_ATTEMPTS } from './useConfirmationPolling'

const MINUTE = 60_000

const booking = (extra: Partial<Booking> = {}): Booking => ({
  id: 'b1',
  status: 'PENDING',
  unit: 'HOUR',
  // Lunes 12 de octubre de 2026, de 10:00 a 12:00 en Chile.
  startAt: '2026-10-12T13:00:00.000Z',
  endAt: '2026-10-12T15:00:00.000Z',
  subtotal: 24000,
  fee: 2400,
  total: 26400,
  expiresAt: new Date(Date.now() + 10 * MINUTE + 30_000).toISOString(),
  createdAt: '2026-10-10T12:00:00.000Z',
  space: { id: 's1', name: 'Sala Alameda', communeName: 'Santiago', address: 'Alameda 123', addressDetail: null, coverUrl: null },
  ...extra,
})

function serve(response: Booking | { status: number; message: string }) {
  server.use(
    http.get('*/api/bookings/:id', () =>
      'id' in response ? HttpResponse.json(response) : HttpResponse.json({ statusCode: response.status, message: response.message }, { status: response.status }),
    ),
  )
}

function renderPage(entry = '/bookings/b1') {
  const router = createMemoryRouter([{ path: '/bookings/:bookingId', element: <BookingPage /> }], {
    initialEntries: [entry],
  })
  return render(<RouterProvider router={router} />)
}

/** Responde la reserva con el estado que toca en cada consulta (el último se repite) y cuenta las consultas. */
function serveSequence(statuses: BookingStatus[]) {
  const counter = { calls: 0 }
  server.use(
    http.get('*/api/bookings/:id', () => {
      const status = statuses[Math.min(counter.calls, statuses.length - 1)]
      counter.calls += 1
      return HttpResponse.json(booking({ status }))
    }),
  )
  return counter
}

/** Avanza los temporizadores falsos y deja que terminen las consultas que dispararon. */
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

describe('BookingPage', () => {
  beforeEach(() => setToken('token-de-prueba'))

  it('muestra el espacio, el estado, el horario en hora de Chile y el desglose', async () => {
    serve(booking())
    renderPage()

    expect(screen.getByRole('status', { name: 'Cargando la reserva' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 1, name: 'Sala Alameda' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sala Alameda' })).toHaveAttribute('href', '/spaces/s1')
    expect(screen.getByText('Pendiente de pago')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Horario' })).toHaveTextContent('lun, 12 oct · 10:00 a 12:00')
    expect(screen.getByRole('region', { name: 'Horario' })).toHaveTextContent('Por hora, 2 horas')
    const amounts = screen.getByRole('region', { name: 'Desglose' })
    expect(amounts).toHaveTextContent('Arriendo$24.000')
    expect(amounts).toHaveTextContent('Comisión de servicio (10 %)$2.400')
    expect(amounts).toHaveTextContent('Total$26.400')
    await waitFor(() => expect(document.title).toBe('Reserva en Sala Alameda · RentSmart'))
  })

  it('si está pendiente, muestra cuánto queda de la retención', async () => {
    serve(booking())
    renderPage()

    expect(await screen.findByText(/Tu horario queda retenido por/)).toHaveTextContent(/retenido por 10:\d\d minutos/)
  })

  it('si la retención ya venció, lo dice y ofrece volver al espacio', async () => {
    serve(booking({ expiresAt: new Date(Date.now() - MINUTE).toISOString() }))
    renderPage()

    expect(await screen.findByText('La retención del horario venció.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al espacio' })).toHaveAttribute('href', '/spaces/s1')
  })

  it('confirmada: sin contador y con el detalle privado de la dirección', async () => {
    serve(booking({ status: 'CONFIRMED', unit: 'DAY', space: { ...booking().space, addressDetail: 'Oficina 402' } }))
    renderPage()

    expect(await screen.findByText('Confirmada')).toBeInTheDocument()
    expect(screen.getByText('Oficina 402')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Horario' })).toHaveTextContent('Por día')
    expect(screen.queryByText(/retenido/)).not.toBeInTheDocument()
  })

  it('"Actualizar el estado" vuelve a consultar la reserva', async () => {
    let calls = 0
    server.use(
      http.get('*/api/bookings/:id', () => {
        calls += 1
        return HttpResponse.json(booking({ status: calls === 1 ? 'PENDING' : 'CONFIRMED' }))
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Actualizar el estado' }))

    expect(await screen.findByText('Confirmada')).toBeInTheDocument()
    expect(calls).toBe(2)
  })

  it.each([
    [404, 'No encontramos esta reserva'],
    [403, 'Esta reserva no es tuya'],
  ])('un %i muestra su mensaje', async (status, heading) => {
    serve({ status, message: 'x' })
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver el catálogo' })).toHaveAttribute('href', '/')
  })

  // PA-01: Stripe vuelve con ?pago=ok o ?pago=cancelado. Con temporizadores falsos que igual avanzan solos, para que
  // findBy* funcione; los saltos de 2 s se hacen a mano.
  describe('al volver de Stripe Checkout', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
    afterEach(() => vi.useRealTimers())

    it('con pago=ok avisa que confirma y consulta cada 2 s hasta verla CONFIRMED, y ahí se detiene', async () => {
      const counter = serveSequence(['PENDING', 'PAID', 'CONFIRMED'])
      renderPage('/bookings/b1?pago=ok')

      expect(await screen.findByText('Pago recibido, confirmando tu reserva…')).toBeInTheDocument()
      // Ya pagó: no muestra la cuenta regresiva de la retención.
      expect(screen.queryByText(/Tu horario queda retenido/)).not.toBeInTheDocument()
      expect(counter.calls).toBe(1)

      await advance(POLL_INTERVAL_MS)
      expect(await screen.findByText('Pagada')).toBeInTheDocument()
      expect(counter.calls).toBe(2)

      await advance(POLL_INTERVAL_MS)
      expect(await screen.findByText('Confirmada')).toBeInTheDocument()
      expect(counter.calls).toBe(3)
      expect(screen.queryByText('Pago recibido, confirmando tu reserva…')).not.toBeInTheDocument()

      await advance(10 * POLL_INTERVAL_MS)
      expect(counter.calls).toBe(3)
    })

    it('se detiene también en otro estado final, como CANCELLED', async () => {
      const counter = serveSequence(['PAID', 'CANCELLED'])
      renderPage('/bookings/b1?pago=ok')

      await screen.findByText('Pago recibido, confirmando tu reserva…')
      await advance(POLL_INTERVAL_MS)
      expect(await screen.findByText('Cancelada')).toBeInTheDocument()

      await advance(5 * POLL_INTERVAL_MS)
      expect(counter.calls).toBe(2)
      expect(screen.queryByText('Pago recibido, confirmando tu reserva…')).not.toBeInTheDocument()
    })

    it(`si después de ${POLL_MAX_ATTEMPTS} consultas sigue pendiente, deja de consultar y deja el botón para actualizar`, async () => {
      const counter = serveSequence(['PENDING'])
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPage('/bookings/b1?pago=ok')

      await screen.findByText('Pago recibido, confirmando tu reserva…')
      for (let i = 0; i < POLL_MAX_ATTEMPTS; i += 1) await advance(POLL_INTERVAL_MS)

      // La carga inicial más los 30 intentos.
      expect(counter.calls).toBe(1 + POLL_MAX_ATTEMPTS)
      expect(await screen.findByText(/Todavía no recibimos la confirmación del pago/)).toBeInTheDocument()
      expect(screen.queryByText('Pago recibido, confirmando tu reserva…')).not.toBeInTheDocument()
      await advance(10 * POLL_INTERVAL_MS)
      expect(counter.calls).toBe(1 + POLL_MAX_ATTEMPTS)

      await user.click(screen.getByRole('button', { name: 'Actualizar el estado' }))
      await waitFor(() => expect(counter.calls).toBe(2 + POLL_MAX_ATTEMPTS))
    })

    it('al salir de la página deja de consultar', async () => {
      const counter = serveSequence(['PENDING'])
      const { unmount } = renderPage('/bookings/b1?pago=ok')

      await screen.findByText('Pago recibido, confirmando tu reserva…')
      unmount()
      await advance(5 * POLL_INTERVAL_MS)

      expect(counter.calls).toBe(1)
    })

    it('si la reserva ya está confirmada, no consulta de nuevo ni muestra el aviso', async () => {
      const counter = serveSequence(['CONFIRMED'])
      renderPage('/bookings/b1?pago=ok')

      expect(await screen.findByText('Confirmada')).toBeInTheDocument()
      await advance(3 * POLL_INTERVAL_MS)

      expect(counter.calls).toBe(1)
      expect(screen.queryByText('Pago recibido, confirmando tu reserva…')).not.toBeInTheDocument()
    })

    it('con pago=cancelado avisa hasta qué hora sigue retenido el horario, sin consultar de nuevo', async () => {
      // La retención vence el lunes 12 de octubre de 2026 a las 12:38 de Chile.
      vi.setSystemTime(new Date('2026-10-12T15:10:00.000Z'))
      const counter = { calls: 0 }
      server.use(
        http.get('*/api/bookings/:id', () => {
          counter.calls += 1
          return HttpResponse.json(booking({ expiresAt: '2026-10-12T15:38:00.000Z' }))
        }),
      )
      renderPage('/bookings/b1?pago=cancelado')

      expect(
        await screen.findByText(
          'Cancelaste el pago. El horario sigue retenido hasta las 12:38; puedes volver atrás a la página de pago o esperar a que venza para elegir otro.',
        ),
      ).toBeInTheDocument()
      // La cuenta regresiva sigue a la vista.
      expect(screen.getByText(/Tu horario queda retenido por/)).toBeInTheDocument()
      await advance(3 * POLL_INTERVAL_MS)
      expect(counter.calls).toBe(1)
    })

    it('con pago=cancelado y la retención ya vencida, no dice que sigue retenido', async () => {
      serve(booking({ expiresAt: new Date(Date.now() - MINUTE).toISOString() }))
      renderPage('/bookings/b1?pago=cancelado')

      expect(await screen.findByText('La retención del horario venció.')).toBeInTheDocument()
      expect(screen.queryByText(/Cancelaste el pago/)).not.toBeInTheDocument()
    })

    it('sin pago en la URL no avisa nada ni consulta de nuevo', async () => {
      const counter = serveSequence(['PENDING', 'CONFIRMED'])
      renderPage()

      expect(await screen.findByText('Pendiente de pago')).toBeInTheDocument()
      await advance(3 * POLL_INTERVAL_MS)

      expect(counter.calls).toBe(1)
      expect(screen.queryByText(/Pago recibido|Cancelaste el pago/)).not.toBeInTheDocument()
    })
  })

  it('otro error se puede reintentar', async () => {
    serve({ status: 500, message: 'Se cayó' })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Se cayó')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
