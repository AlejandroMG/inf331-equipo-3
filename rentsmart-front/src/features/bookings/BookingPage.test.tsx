import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { setToken } from '../../lib/token'
import { server } from '../../mocks/server'
import { BookingPage } from './BookingPage'
import type { Booking } from './types'

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

function renderPage() {
  const router = createMemoryRouter([{ path: '/bookings/:bookingId', element: <BookingPage /> }], {
    initialEntries: ['/bookings/b1'],
  })
  render(<RouterProvider router={router} />)
}

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

  it('otro error se puede reintentar', async () => {
    serve({ status: 500, message: 'Se cayó' })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Se cayó')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
