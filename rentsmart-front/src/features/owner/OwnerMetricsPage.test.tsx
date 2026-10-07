import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http as mswHttp, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { server } from '../../mocks/server'
import { currentMonthInSantiago } from './booking-format'
import { OwnerMetricsPage } from './OwnerMetricsPage'
import type { OwnerMetrics, SpaceMetrics } from './types'

const space = (overrides: Partial<SpaceMetrics> = {}): SpaceMetrics => ({
  id: 's1',
  name: 'Sala Alameda',
  status: 'ACTIVE',
  income: 72000,
  bookings: 3,
  bookedHours: 6,
  availableHours: 68,
  occupancy: 0.088,
  ...overrides,
})

/** Responde la API de métricas con el mes pedido y guarda los meses que le piden. */
function serveMetrics(spaces: SpaceMetrics[], income = spaces.reduce((sum, s) => sum + s.income, 0)) {
  const months: Array<string | null> = []
  server.use(
    mswHttp.get('*/api/owner/metrics', ({ request }) => {
      const month = new URL(request.url).searchParams.get('month')
      months.push(month)
      const body: OwnerMetrics = { month: month ?? '2026-10', income, bookings: spaces.reduce((sum, s) => sum + s.bookings, 0), spaces }
      return HttpResponse.json(body)
    }),
  )
  return months
}

function renderPage(path = '/owner/metrics?month=2026-10') {
  const router = createMemoryRouter(
    [
      { path: 'owner/metrics', element: <OwnerMetricsPage /> },
      { path: 'owner/spaces', element: <h1>Mis espacios</h1> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('OwnerMetricsPage (PN-04)', () => {
  it('muestra los ingresos y las reservas del mes', async () => {
    serveMetrics([space(), space({ id: 's2', name: 'Taller', income: 9000, bookings: 1, availableHours: 0, occupancy: null })])
    renderPage()

    const summary = await screen.findByRole('list', { name: 'Resumen del mes' })

    expect(within(summary).getByText('$81.000')).toBeInTheDocument()
    expect(within(summary).getByText('Ingresos del mes')).toBeInTheDocument()
    expect(within(summary).getByText('4')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'octubre de 2026' })).toBeInTheDocument()
  })

  it('por espacio: ingresos, reservas y ocupación con las horas reservadas sobre las arrendables', async () => {
    serveMetrics([space()])
    renderPage()

    const row = (await screen.findByRole('heading', { level: 3, name: 'Sala Alameda' })).closest('li')!

    expect(within(row).getByText('$72.000')).toBeInTheDocument()
    expect(within(row).getByText('· 3 reservas')).toBeInTheDocument()
    expect(within(row).getByText('Ocupación 9 %')).toBeInTheDocument()
    expect(within(row).getByText(/6 de 68 horas arrendables/)).toBeInTheDocument()
  })

  it('un espacio sin horario explica por qué no hay ocupación', async () => {
    serveMetrics([space({ availableHours: 0, occupancy: null, bookings: 1, income: 9000 })])
    renderPage()

    expect(await screen.findByText('Sin horario cargado: no se puede calcular la ocupación.')).toBeInTheDocument()
    expect(screen.getByText('· 1 reserva')).toBeInTheDocument()
  })

  it('una ocupación del 100 % no pasa del ancho de la barra', async () => {
    serveMetrics([space({ occupancy: 1, bookedHours: 68 })])
    renderPage()

    const row = (await screen.findByRole('heading', { level: 3, name: 'Sala Alameda' })).closest('li')!

    expect(within(row).getByText('Ocupación 100 %')).toBeInTheDocument()
    expect(row.querySelector('[style]')).toHaveStyle({ width: '100%' })
  })

  it('sin espacios publicados lo dice', async () => {
    serveMetrics([], 0)
    renderPage()

    expect(await screen.findByRole('heading', { level: 2, name: 'Todavía no tienes espacios publicados' })).toBeInTheDocument()
  })

  describe('el mes', () => {
    it('pide el mes de la URL', async () => {
      const months = serveMetrics([space()])
      renderPage('/owner/metrics?month=2026-09')
      await screen.findByRole('heading', { level: 3 })

      expect(months[0]).toBe('2026-09')
      expect(screen.getByRole('heading', { level: 2, name: 'septiembre de 2026' })).toBeInTheDocument()
    })

    it('sin mes en la URL usa el actual, en la hora de Chile', async () => {
      const months = serveMetrics([space()])
      renderPage('/owner/metrics')
      await screen.findByRole('heading', { level: 3 })

      expect(months[0]).toBe(currentMonthInSantiago())
    })

    it.each(['?month=2026-13', '?month=octubre', '?month=1999-01'])('un mes inválido en la URL (%s) se ignora', async (query) => {
      const months = serveMetrics([space()])
      renderPage(`/owner/metrics${query}`)
      await screen.findByRole('heading', { level: 3 })

      expect(months[0]).toBe(currentMonthInSantiago())
    })

    it('"Mes anterior" y "Mes siguiente" cambian el mes en la URL', async () => {
      const months = serveMetrics([space()])
      const router = renderPage()
      await screen.findByRole('heading', { level: 3 })

      await userEvent.click(screen.getByRole('link', { name: 'Mes anterior' }))
      expect(await screen.findByRole('heading', { level: 2, name: 'septiembre de 2026' })).toBeInTheDocument()
      expect(router.state.location.search).toBe('?month=2026-09')

      await userEvent.click(screen.getByRole('link', { name: 'Mes siguiente' }))
      await screen.findByRole('heading', { level: 2, name: 'octubre de 2026' })
      expect(months).toContain('2026-09')
    })

    it('cruza el cambio de año', async () => {
      serveMetrics([space()])
      renderPage('/owner/metrics?month=2026-01')
      await screen.findByRole('heading', { level: 3 })

      expect(screen.getByRole('link', { name: 'Mes anterior' })).toHaveAttribute('href', '/owner/metrics?month=2025-12')
    })

    it('en otro mes ofrece volver al actual; en el actual no', async () => {
      serveMetrics([space()])
      renderPage('/owner/metrics?month=2020-01')
      await screen.findByRole('heading', { level: 3 })
      expect(screen.getByRole('link', { name: 'Ir al mes actual' })).toBeInTheDocument()
    })

    it('en el mes actual no ofrece volver a él', async () => {
      serveMetrics([space()])
      renderPage(`/owner/metrics?month=${currentMonthInSantiago()}`)
      await screen.findByRole('heading', { level: 3 })

      expect(screen.queryByRole('link', { name: 'Ir al mes actual' })).not.toBeInTheDocument()
    })
  })

  it('tiene la navegación del panel con "Métricas" como la página actual', async () => {
    serveMetrics([])
    renderPage()

    const nav = await screen.findByRole('navigation', { name: 'Panel del propietario' })

    expect(within(nav).getByRole('link', { name: 'Métricas' })).toHaveAttribute('aria-current', 'page')
  })

  it('si falla la carga muestra el error y deja reintentar', async () => {
    let fails = true
    server.use(
      mswHttp.get('*/api/owner/metrics', () =>
        fails ? HttpResponse.json({ message: 'Falló el servidor' }, { status: 500 }) : HttpResponse.json({ month: '2026-10', income: 0, bookings: 0, spaces: [] }),
      ),
    )
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tus métricas.')
    fails = false
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('heading', { level: 2, name: 'Todavía no tienes espacios publicados' })).toBeInTheDocument()
  })

  it('muestra un estado de carga', () => {
    serveMetrics([])
    renderPage()

    expect(screen.getByRole('status', { name: 'Cargando métricas' })).toBeInTheDocument()
  })
})
