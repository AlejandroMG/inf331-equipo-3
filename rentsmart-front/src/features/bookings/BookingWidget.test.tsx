import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider, useLocation, useParams } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { setToken } from '../../lib/token'
import { resetMockBookings } from '../../mocks/bookings-handlers'
import { server } from '../../mocks/server'
import { BookingWidget, type BookingWidgetProps } from './BookingWidget'

// Contra el mock de MSW: los espacios del catálogo simulado se arriendan de lunes a viernes de 09:00 a 21:00 y las
// horas que ya pasaron siguen libres, así que el primer día ofrecido siempre tiene el bloque de 09:00 y el de 10:00.
const SPACE = 'seed-space-2'
const BOTH: Omit<BookingWidgetProps, 'spaceId'> = { pricePerHour: 18000, pricePerDay: 120000 }

function BookingStub() {
  const { bookingId } = useParams()
  return <h1>Página de la reserva {bookingId}</h1>
}

function LoginStub() {
  const location = useLocation()
  return <h1>Login desde {(location.state as { from?: string } | null)?.from}</h1>
}

function renderWidget(prices = BOTH) {
  const router = createMemoryRouter(
    [
      { path: '/spaces/:spaceId', element: <BookingWidget spaceId={SPACE} {...prices} /> },
      { path: '/bookings/:bookingId', element: <BookingStub /> },
      { path: '/login', element: <LoginStub /> },
    ],
    { initialEntries: [`/spaces/${SPACE}`] },
  )
  render(<RouterProvider router={router} />)
  return router
}

/** Elige el bloque de 09:00 y el de 10:00 del primer día ofrecido. */
async function pickTwoHours(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: '09:00 a 10:00' }))
  await user.click(screen.getByRole('button', { name: '10:00 a 11:00' }))
}

describe('BookingWidget', () => {
  afterEach(() => resetMockBookings())

  it('carga la disponibilidad y deja reservar recién cuando se elige un horario', async () => {
    renderWidget()

    expect(screen.getByRole('status', { name: 'Cargando la disponibilidad' })).toBeInTheDocument()
    expect(await screen.findByRole('combobox', { name: 'Día' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reservar' })).toBeDisabled()
    expect(screen.queryByRole('region', { name: 'Desglose del precio' })).not.toBeInTheDocument()
  })

  it('por hora: elige bloques seguidos y muestra el desglose con la comisión', async () => {
    const user = userEvent.setup()
    renderWidget()

    await pickTwoHours(user)

    expect(screen.getByRole('button', { name: '09:00 a 10:00' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '10:00 a 11:00' })).toHaveAttribute('aria-pressed', 'true')
    const breakdown = screen.getByRole('region', { name: 'Desglose del precio' })
    expect(breakdown).toHaveTextContent('09:00 a 11:00')
    expect(breakdown).toHaveTextContent('$18.000 × 2 horas$36.000')
    expect(breakdown).toHaveTextContent('Comisión de servicio (10 %)$3.600')
    expect(breakdown).toHaveTextContent('Total$39.600')
    expect(screen.getByRole('button', { name: 'Reservar' })).toBeEnabled()
  })

  it('por día: toma el día completo y cobra el precio por día', async () => {
    const user = userEvent.setup()
    renderWidget()

    await user.click(await screen.findByRole('radio', { name: 'Por día' }))

    expect(await screen.findByText(/Día completo:/)).toHaveTextContent('09:00 a 21:00')
    const breakdown = screen.getByRole('region', { name: 'Desglose del precio' })
    expect(breakdown).toHaveTextContent('Precio por día$120.000')
    expect(breakdown).toHaveTextContent('Total$132.000')
  })

  it('con solo precio por hora no ofrece elegir la unidad', async () => {
    renderWidget({ pricePerHour: 18000, pricePerDay: null })

    await screen.findByRole('combobox', { name: 'Día' })
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('con sesión, reserva y redirige al checkout que entrega la API', async () => {
    setToken('token-de-prueba')
    let sent: unknown
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'POST' && new URL(request.url).pathname === '/api/bookings') sent = await request.clone().json()
    })
    const user = userEvent.setup()
    const router = renderWidget()

    await pickTwoHours(user)
    await user.click(screen.getByRole('button', { name: 'Reservar' }))

    expect(await screen.findByRole('heading', { name: 'Página de la reserva booking-1' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/bookings/booking-1')
    // Se mandan las horas en UTC tal como vinieron de la disponibilidad, sin montos.
    expect(sent).toEqual({
      spaceId: SPACE,
      startAt: expect.stringMatching(/T\d{2}:00:00\.000Z$/),
      endAt: expect.stringMatching(/T\d{2}:00:00\.000Z$/),
      unit: 'HOUR',
    })
    const { startAt, endAt } = sent as { startAt: string; endAt: string }
    expect(Date.parse(endAt) - Date.parse(startAt)).toBe(2 * 3_600_000)
  })

  it('si checkoutUrl es /bookings/<id> de otro origen (FRONTEND_URL distinto), navega dentro de la app', async () => {
    setToken('token-de-prueba')
    server.use(
      http.post('*/api/bookings', () =>
        HttpResponse.json({ bookingId: 'b-77', checkoutUrl: 'http://127.0.0.1:9999/bookings/b-77' }, { status: 201 }),
      ),
    )
    const user = userEvent.setup()
    const router = renderWidget()

    await pickTwoHours(user)
    await user.click(screen.getByRole('button', { name: 'Reservar' }))

    expect(await screen.findByRole('heading', { name: 'Página de la reserva b-77' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/bookings/b-77')
  })

  it('sin sesión, reservar lleva al login y recuerda de dónde venía', async () => {
    const user = userEvent.setup()
    const router = renderWidget()
    expect(await screen.findByText('Te pediremos iniciar sesión para reservar.')).toBeInTheDocument()

    await pickTwoHours(user)
    await user.click(screen.getByRole('button', { name: 'Reservar' }))

    expect(await screen.findByRole('heading', { name: `Login desde /spaces/${SPACE}` })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('un 409 muestra el mensaje del back, quita la selección y recarga la disponibilidad', async () => {
    setToken('token-de-prueba')
    let availabilityCalls = 0
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname.endsWith('/availability')) availabilityCalls += 1
    })
    server.use(
      http.post('*/api/bookings', () =>
        HttpResponse.json({ statusCode: 409, error: 'Conflict', message: 'Ese horario ya está reservado' }, { status: 409 }),
      ),
    )
    const user = userEvent.setup()
    renderWidget()

    await pickTwoHours(user)
    await user.click(screen.getByRole('button', { name: 'Reservar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ese horario ya está reservado')
    await waitFor(() => expect(availabilityCalls).toBe(2))
    expect(await screen.findByRole('button', { name: '09:00 a 10:00' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Reservar' })).toBeDisabled()
  })

  it('un 400 muestra el mensaje del back y deja la selección', async () => {
    setToken('token-de-prueba')
    server.use(
      http.post('*/api/bookings', () =>
        HttpResponse.json({ statusCode: 400, error: 'Bad Request', message: 'Este espacio no se arrienda por hora' }, { status: 400 }),
      ),
    )
    const user = userEvent.setup()
    renderWidget()

    await pickTwoHours(user)
    await user.click(screen.getByRole('button', { name: 'Reservar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Este espacio no se arrienda por hora')
    expect(screen.getByRole('button', { name: '10:00 a 11:00' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('si el espacio no tiene disponibilidad (404), lo dice sin un error', async () => {
    server.use(
      http.get('*/api/spaces/:id/availability', () =>
        HttpResponse.json({ statusCode: 404, error: 'Not Found', message: 'El espacio no existe' }, { status: 404 }),
      ),
    )
    renderWidget()

    expect(await screen.findByText('Este espacio no tiene horarios disponibles para reservar.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('si no hay días libres, lo dice', async () => {
    server.use(
      http.get('*/api/spaces/:id/availability', () =>
        HttpResponse.json({ spaceId: SPACE, timeZone: 'America/Santiago', days: [{ date: '2026-10-12', slots: [], fullDay: null }] }),
      ),
    )
    renderWidget()

    expect(await screen.findByText('No hay horarios libres en los próximos 14 días.')).toBeInTheDocument()
    expect(within(document.body).getByRole('button', { name: 'Reservar' })).toBeDisabled()
  })
})
