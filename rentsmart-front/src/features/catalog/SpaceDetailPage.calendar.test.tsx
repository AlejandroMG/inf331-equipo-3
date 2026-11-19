import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http as mswHttp, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { resetMockBookings } from '../../mocks/bookings-handlers'
import { server } from '../../mocks/server'
import { SpaceDetailPage } from './SpaceDetailPage'
import type { SpaceDetail } from './types'

// El calendario del detalle y el widget de reserva juntos (BU-06). El espacio tiene el id de uno del catálogo simulado
// para que su disponibilidad exista: lunes a viernes de 09:00 a 21:00.
const detail: SpaceDetail = {
  id: 'seed-space-2',
  name: 'Sala Alameda',
  description: 'Sala luminosa en pleno centro.',
  typeName: 'Sala de reuniones',
  regionName: 'Región Metropolitana',
  communeName: 'Santiago',
  address: 'Av. Libertador 1234',
  location: null,
  capacity: 10,
  pricePerHour: 18000,
  pricePerDay: 120000,
  rules: null,
  amenities: [],
  photos: [],
  schedule: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: '09:00', endTime: '21:00' })),
  host: { id: 'host-1', name: 'Ana Pérez', profilePhotoUrl: null },
}

function renderDetail(space: Partial<SpaceDetail> = {}) {
  server.use(mswHttp.get('*/api/catalog/seed-space-2', () => HttpResponse.json({ ...detail, ...space })))
  const router = createMemoryRouter([{ path: '/spaces/:spaceId', element: <SpaceDetailPage /> }], {
    initialEntries: ['/spaces/seed-space-2'],
  })
  render(<RouterProvider router={router} />)
}

describe('SpaceDetailPage: calendario de disponibilidad', () => {
  afterEach(() => resetMockBookings())

  it('muestra la sección «Disponibilidad» con los bloques de la semana', async () => {
    renderDetail()

    const section = (await screen.findByRole('heading', { level: 2, name: 'Disponibilidad' })).closest('section')!
    expect((await within(section).findAllByRole('button', { name: /: libre$/ })).length).toBeGreaterThan(0)
  })

  it('al tocar un bloque libre lo deja elegido en la reserva y lleva el foco a ella', async () => {
    const user = userEvent.setup()
    renderDetail()
    const section = (await screen.findByRole('heading', { level: 2, name: 'Disponibilidad' })).closest('section')!

    await user.click((await within(section).findAllByRole('button', { name: /10:00 a 11:00: libre$/ }))[0])

    const booking = screen.getByRole('complementary', { name: 'Reservar' })
    expect(await within(booking).findByRole('button', { name: '10:00 a 11:00' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(booking).getByRole('region', { name: 'Desglose del precio' })).toHaveTextContent('Total$19.800')
    expect(booking).toHaveFocus()
  })

  it('un bloque de la segunda semana cambia el día de la reserva', async () => {
    const user = userEvent.setup()
    renderDetail()
    const section = (await screen.findByRole('heading', { level: 2, name: 'Disponibilidad' })).closest('section')!
    const booking = screen.getByRole('complementary', { name: 'Reservar' })
    const day = await within(booking).findByRole('combobox', { name: 'Día' })
    const firstDay = (day as HTMLSelectElement).value

    await within(section).findAllByRole('button', { name: /: libre$/ })
    await user.click(within(section).getByRole('button', { name: 'Semana siguiente' }))
    await user.click(within(section).getAllByRole('button', { name: /09:00 a 10:00: libre$/ })[0])

    expect(await within(booking).findByRole('button', { name: '09:00 a 10:00' })).toHaveAttribute('aria-pressed', 'true')
    expect((day as HTMLSelectElement).value).not.toBe(firstDay)
  })

  it('en un espacio solo por día, elegir un día deja la reserva por día', async () => {
    const user = userEvent.setup()
    renderDetail({ pricePerHour: null })
    const section = (await screen.findByRole('heading', { level: 2, name: 'Disponibilidad' })).closest('section')!

    await user.click((await within(section).findAllByRole('button', { name: /, día completo: libre$/ }))[0])

    const booking = screen.getByRole('complementary', { name: 'Reservar' })
    expect(await within(booking).findByText(/Día completo:/)).toHaveTextContent('09:00 a 21:00')
    expect(within(booking).getByRole('region', { name: 'Desglose del precio' })).toHaveTextContent('Total$132.000')
  })

  it('sin horario semanal no hay calendario', async () => {
    renderDetail({ schedule: [] })

    await screen.findByRole('heading', { level: 1, name: 'Sala Alameda' })
    expect(screen.queryByRole('heading', { level: 2, name: 'Disponibilidad' })).not.toBeInTheDocument()
  })
})
