import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http as mswHttp, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { server } from '../../mocks/server'
import { OwnerBookingsPage } from './OwnerBookingsPage'
import type { OwnerBooking } from './types'

const booking = (overrides: Partial<OwnerBooking> = {}): OwnerBooking => ({
  id: 'b1',
  spaceId: 's1',
  spaceName: 'Sala Alameda',
  renterName: 'Camila Rojas',
  startAt: '2026-10-05T16:00:00.000Z',
  endAt: '2026-10-05T19:00:00.000Z',
  unit: 'HOUR',
  subtotal: 36000,
  status: 'CONFIRMED',
  contact: { email: 'camila@correo.test', phone: '+56 9 1234 5678' },
  ...overrides,
})

/** Responde la API de reservas y guarda las consultas que recibe, para comprobar qué se pidió. */
function serveBookings(items: OwnerBooking[], total = items.length) {
  const queries: URLSearchParams[] = []
  server.use(
    mswHttp.get('*/api/owner/bookings', ({ request }) => {
      const url = new URL(request.url)
      queries.push(url.searchParams)
      return HttpResponse.json({ items, total, page: Number(url.searchParams.get('page')) || 1, pageSize: 20 })
    }),
  )
  return queries
}

function renderPage(path = '/owner/bookings') {
  const router = createMemoryRouter(
    [
      { path: 'owner/bookings', element: <OwnerBookingsPage /> },
      { path: 'owner/spaces', element: <h1>Mis espacios</h1> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('OwnerBookingsPage (PN-02)', () => {
  it('lista las reservas con el espacio, el horario en hora de Chile, el arrendatario y lo que recibe el propietario', async () => {
    serveBookings([booking()])
    renderPage()

    const card = (await screen.findByRole('heading', { level: 2, name: 'Sala Alameda' })).closest('li')!

    expect(within(card).getByText('Confirmada')).toBeInTheDocument()
    expect(within(card).getByText('lun, 5 oct · 13:00 a 16:00')).toBeInTheDocument()
    expect(within(card).getByText('Camila Rojas · $36.000')).toBeInTheDocument()
    expect(screen.getByText('1 reserva')).toBeInTheDocument()
  })

  it('en las confirmadas muestra el contacto del arrendatario como enlaces', async () => {
    serveBookings([booking()])
    renderPage()

    expect(await screen.findByRole('link', { name: 'camila@correo.test' })).toHaveAttribute('href', 'mailto:camila@correo.test')
    expect(screen.getByRole('link', { name: '+56 9 1234 5678' })).toHaveAttribute('href', 'tel:+56912345678')
  })

  it('sin contacto (cualquier otro estado) no muestra enlaces de contacto', async () => {
    serveBookings([booking({ status: 'FINISHED', contact: null })])
    renderPage()

    await screen.findByText('Finalizada')

    expect(screen.queryByRole('link', { name: /@/ })).not.toBeInTheDocument()
  })

  it('un contacto sin teléfono solo muestra el email', async () => {
    serveBookings([booking({ contact: { email: 'camila@correo.test', phone: null } })])
    renderPage()

    await screen.findByRole('link', { name: 'camila@correo.test' })

    expect(screen.queryByRole('link', { name: /\+56/ })).not.toBeInTheDocument()
  })

  it('una reserva por día lo dice', async () => {
    serveBookings([booking({ unit: 'DAY', subtotal: 90000 })])
    renderPage()

    expect(await screen.findByText('Camila Rojas · $90.000 · por día')).toBeInTheDocument()
  })

  it('tiene la navegación del panel con "Reservas" como la página actual', async () => {
    serveBookings([])
    renderPage()

    const nav = await screen.findByRole('navigation', { name: 'Panel del propietario' })

    expect(within(nav).getByRole('link', { name: 'Reservas' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Mis espacios' })).toHaveAttribute('href', '/owner/spaces')
    expect(within(nav).getByRole('link', { name: 'Métricas' })).toHaveAttribute('href', '/owner/metrics')
  })

  describe('filtros', () => {
    it('sin filtros pide las más lejanas primero y no manda estado ni fechas', async () => {
      const queries = serveBookings([booking()])
      renderPage()
      await screen.findByRole('heading', { level: 2 })

      expect(queries[0].get('sort')).toBe('desc')
      for (const key of ['status', 'from', 'to']) expect(queries[0].has(key)).toBe(false)
    })

    it('elegir un estado lo manda a la API y lo deja en la URL', async () => {
      const queries = serveBookings([booking()])
      const router = renderPage()
      await screen.findByRole('heading', { level: 2 })

      await userEvent.selectOptions(screen.getByLabelText('Estado'), 'Pagada')

      await waitFor(() => expect(queries.at(-1)?.get('status')).toBe('PAID'))
      expect(router.state.location.search).toBe('?status=PAID')
    })

    it('las fechas se mandan como días AAAA-MM-DD y quedan en la URL', async () => {
      const queries = serveBookings([booking()])
      const router = renderPage()
      await screen.findByRole('heading', { level: 2 })

      await userEvent.type(screen.getByLabelText('Desde'), '2026-10-01')
      await userEvent.type(screen.getByLabelText('Hasta'), '2026-10-31')

      await waitFor(() => expect(queries.at(-1)?.get('to')).toBe('2026-10-31'))
      expect(queries.at(-1)?.get('from')).toBe('2026-10-01')
      expect(router.state.location.search).toBe('?from=2026-10-01&to=2026-10-31')
    })

    it('no deja armar un rango al revés: "Hasta" no admite fechas anteriores a "Desde"', async () => {
      serveBookings([booking()])
      renderPage('/owner/bookings?from=2026-10-10&to=2026-10-20')
      await screen.findByRole('heading', { level: 2 })

      expect(screen.getByLabelText('Hasta')).toHaveAttribute('min', '2026-10-10')
      expect(screen.getByLabelText('Desde')).toHaveAttribute('max', '2026-10-20')
    })

    it('cambiar el orden pide las más próximas primero', async () => {
      const queries = serveBookings([booking()])
      const router = renderPage()
      await screen.findByRole('heading', { level: 2 })

      await userEvent.selectOptions(screen.getByLabelText('Orden'), 'Más próximas primero')

      await waitFor(() => expect(queries.at(-1)?.get('sort')).toBe('asc'))
      expect(router.state.location.search).toBe('?sort=asc')
    })

    it('abre con los filtros de la URL ya aplicados', async () => {
      const queries = serveBookings([booking()])
      renderPage('/owner/bookings?status=CONFIRMED&from=2026-10-01&sort=asc')
      await screen.findByRole('heading', { level: 2 })

      expect(screen.getByLabelText('Estado')).toHaveValue('CONFIRMED')
      expect(screen.getByLabelText('Desde')).toHaveValue('2026-10-01')
      expect(screen.getByLabelText('Orden')).toHaveValue('asc')
      expect(queries[0].get('status')).toBe('CONFIRMED')
    })

    it.each(['?status=ACEPTADA', '?from=03-10-2026', '?to=ayer', '?sort=azar', '?page=abc'])('un valor inválido en la URL (%s) se ignora', async (query) => {
      const queries = serveBookings([booking()])
      renderPage(`/owner/bookings${query}`)
      await screen.findByRole('heading', { level: 2 })

      expect(queries[0].has('status')).toBe(false)
      expect(queries[0].has('from')).toBe(false)
      expect(queries[0].get('sort')).toBe('desc')
      expect(queries[0].get('page')).toBe('1')
    })

    it('"Limpiar filtros" aparece con filtros y los quita', async () => {
      serveBookings([booking()])
      const router = renderPage('/owner/bookings?status=PAID&from=2026-10-01')
      await screen.findByRole('heading', { level: 2 })

      await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

      expect(router.state.location.search).toBe('')
      expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument()
    })

    it('cambiar un filtro vuelve a la primera página', async () => {
      serveBookings([booking()], 45)
      const router = renderPage('/owner/bookings?page=3')
      await screen.findByRole('heading', { level: 2 })

      await userEvent.selectOptions(screen.getByLabelText('Estado'), 'Pagada')

      await waitFor(() => expect(router.state.location.search).toBe('?status=PAID'))
    })
  })

  describe('estados vacíos y errores', () => {
    it('sin reservas lo dice', async () => {
      serveBookings([])
      renderPage()

      expect(await screen.findByRole('heading', { level: 2, name: 'Todavía no tienes reservas' })).toBeInTheDocument()
    })

    it('con filtros y sin resultados lo dice distinto', async () => {
      serveBookings([])
      renderPage('/owner/bookings?status=CANCELLED')

      expect(await screen.findByRole('heading', { level: 2, name: 'No hay reservas con esos filtros' })).toBeInTheDocument()
    })

    it('si falla la carga muestra el error y deja reintentar', async () => {
      let fails = true
      server.use(
        mswHttp.get('*/api/owner/bookings', () =>
          fails ? HttpResponse.json({ message: 'Falló el servidor' }, { status: 500 }) : HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20 }),
        ),
      )
      renderPage()

      expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tus reservas.')
      fails = false
      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

      expect(await screen.findByRole('heading', { level: 2, name: 'Todavía no tienes reservas' })).toBeInTheDocument()
    })

    it('muestra un estado de carga', () => {
      serveBookings([])
      renderPage()

      expect(screen.getByRole('status', { name: 'Cargando reservas' })).toBeInTheDocument()
    })
  })

  describe('paginación', () => {
    it('pide la página de la URL y sus enlaces conservan los filtros', async () => {
      const queries = serveBookings([booking()], 45)
      renderPage('/owner/bookings?status=CONFIRMED&page=2')
      await screen.findByRole('heading', { level: 2 })

      expect(queries[0].get('page')).toBe('2')
      expect(screen.getByRole('link', { name: 'Página 3' })).toHaveAttribute('href', '/owner/bookings?status=CONFIRMED&page=3')
    })
  })
})
