import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setToken } from '../../lib/token'
import { server } from '../../mocks/server'
import { RenterBookingsPage } from './RenterBookingsPage'
import type { Booking, BookingsPage, Payment, PaymentsPage } from './types'

const booking = (overrides: Partial<Booking> = {}): Booking => ({
  id: 'booking-12345678',
  status: 'PENDING',
  unit: 'HOUR',
  startAt: '2026-11-25T13:00:00.000Z',
  endAt: '2026-11-25T15:00:00.000Z',
  subtotal: 24000,
  fee: 2400,
  total: 26400,
  expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  createdAt: new Date().toISOString(),
  refundedAmount: 0,
  space: { id: 'space-1', name: 'Sala Alameda', communeName: 'Santiago', address: 'Alameda 123', addressDetail: null, coverUrl: null },
  ...overrides,
})

const payment: Payment = {
  id: 'payment-123',
  bookingId: 'booking-12345678',
  spaceName: 'Sala Alameda',
  amount: 26400,
  fee: 2400,
  refundedAmount: 0,
  status: 'SUCCEEDED',
  createdAt: '2026-11-17T15:00:00.000Z',
}

function serveBookings(items: Booking[], total = items.length) {
  const queries: URLSearchParams[] = []
  server.use(
    http.get('*/api/bookings/me', ({ request }) => {
      const url = new URL(request.url)
      queries.push(url.searchParams)
      return HttpResponse.json({ items, total, page: Number(url.searchParams.get('page')) || 1, pageSize: 20 } satisfies BookingsPage)
    }),
  )
  return queries
}

function servePayments(items: Payment[] = [payment]) {
  server.use(http.get('*/api/payments/me', ({ request }) => {
    const url = new URL(request.url)
    return HttpResponse.json({ items, total: items.length, page: Number(url.searchParams.get('page')) || 1, pageSize: 20 } satisfies PaymentsPage)
  }))
}

function renderPage(path = '/bookings') {
  const router = createMemoryRouter(
    [
      { path: '/bookings', element: <RenterBookingsPage /> },
      { path: '/bookings/:bookingId', element: <h1>Detalle de reserva</h1> },
      { path: '/', element: <h1>Catálogo</h1> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('RenterBookingsPage (PN-03)', () => {
  beforeEach(() => setToken('mock-token'))
  afterEach(() => vi.restoreAllMocks())

  it('lista reservas con estado, desglose y acciones disponibles', async () => {
    serveBookings([booking()])
    renderPage()

    const card = (await screen.findByRole('heading', { level: 2, name: 'Sala Alameda' })).closest('li')!
    expect(within(card).getByText('Pendiente de pago')).toBeInTheDocument()
    expect(within(card).getByText('mié, 25 nov · 10:00 a 12:00')).toBeInTheDocument()
    expect(within(card).getByText('Total')).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Pagar' })).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: 'Ver reserva' })).toHaveAttribute('href', '/bookings/booking-12345678')
  })

  it('filtra reservas por estado y actualiza la URL', async () => {
    const queries = serveBookings([booking({ status: 'CONFIRMED' })])
    const router = renderPage()
    await screen.findByRole('heading', { level: 2, name: 'Sala Alameda' })

    await userEvent.selectOptions(screen.getByLabelText('Filtrar por estado'), 'CONFIRMED')

    await waitFor(() => expect(queries.at(-1)?.get('status')).toBe('CONFIRMED'))
    expect(router.state.location.search).toBe('?status=CONFIRMED')
  })

  it('continúa el checkout vigente desde el panel', async () => {
    serveBookings([booking()])
    server.use(http.get('*/api/bookings/:id/checkout', ({ params }) =>
      HttpResponse.json({ bookingId: params.id, checkoutUrl: `http://localhost:3000/bookings/${params.id}?pago=ok` }),
    ))
    const router = renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Pagar' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/bookings/booking-12345678'))
    expect(router.state.location.search).toBe('?pago=ok')
  })

  it('cancela una reserva confirmada con motivo y refresca el estado', async () => {
    let current = booking({ status: 'CONFIRMED' })
    server.use(
      http.get('*/api/bookings/me', () => HttpResponse.json({ items: [current], total: 1, page: 1, pageSize: 20 })),
      http.post('*/api/bookings/:id/cancel', () => {
        current = booking({ status: 'CANCELLED' })
        return HttpResponse.json(current)
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Cancelar' }))
    const dialog = screen.getByRole('dialog', { name: '¿Cancelar la reserva?' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Motivo' }), 'Cambio de planes')
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar reserva' }))

    expect(await screen.findByText('Cancelada')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '¿Cancelar la reserva?' })).not.toBeInTheDocument()
  })

  it('muestra historial y permite abrir e imprimir el comprobante', async () => {
    serveBookings([])
    servePayments()
    renderPage('/bookings?tab=payments')

    const record = (await screen.findByRole('heading', { level: 2, name: 'Sala Alameda' })).closest('li')!
    expect(within(record).getByText('Pagado')).toBeInTheDocument()
    expect(within(record).getByText(/Total:/)).toHaveTextContent('$26.400')
    await userEvent.click(within(record).getByRole('button', { name: 'Ver comprobante' }))

    const receipt = screen.getByRole('dialog', { name: 'Comprobante de pago' })
    expect(within(receipt).getByText('payment-123')).toBeInTheDocument()
    expect(within(receipt).getByText('$26.400')).toBeInTheDocument()
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    await userEvent.click(within(receipt).getByRole('button', { name: 'Imprimir o guardar como PDF' }))
    expect(print).toHaveBeenCalledOnce()
  })
})
