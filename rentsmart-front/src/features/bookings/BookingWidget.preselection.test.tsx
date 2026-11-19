import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { resetMockBookings } from '../../mocks/bookings-handlers'
import { BookingWidget, type BookingPreselection, type BookingWidgetProps } from './BookingWidget'
import { addDays, BOOKING_WINDOW_DAYS, todayInSantiago } from './booking-selection'
import { getAvailability } from './bookings-api'

// La precarga que usa el calendario del detalle (BU-06). Contra el mock de MSW: lunes a viernes de 09:00 a 21:00.
const SPACE = 'seed-space-2'
const BOTH: Omit<BookingWidgetProps, 'spaceId'> = { pricePerHour: 18000, pricePerDay: 120000 }

function renderWidget(preselection: BookingPreselection | undefined, prices = BOTH) {
  const router = createMemoryRouter([{ path: '/', element: <BookingWidget spaceId={SPACE} {...prices} preselection={preselection} /> }])
  render(<RouterProvider router={router} />)
}

/** El segundo día reservable por hora (con bloques libres) o por día (completo libre), tal como lo entrega la disponibilidad. */
async function secondBookableDay(unit: 'HOUR' | 'DAY' = 'HOUR') {
  const from = todayInSantiago()
  const { days } = await getAvailability(SPACE, from, addDays(from, BOOKING_WINDOW_DAYS - 1))
  return days.filter((day) => (unit === 'DAY' ? day.fullDay?.available === true : day.slots.length > 0))[1]
}

describe('BookingWidget con una elección previa', () => {
  afterEach(() => resetMockBookings())

  it('deja marcado el bloque elegido, en su día, con el desglose', async () => {
    const day = await secondBookableDay()
    renderWidget({ key: 1, unit: 'HOUR', date: day.date, startAt: day.slots[3].startAt })

    expect(await screen.findByRole('button', { name: '12:00 a 13:00' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('combobox', { name: 'Día' })).toHaveValue(day.date)
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)
    expect(screen.getByRole('region', { name: 'Desglose del precio' })).toHaveTextContent('Total$19.800')
    expect(screen.getByRole('button', { name: 'Reservar' })).toBeEnabled()
  })

  it('un día completo cambia a "Por día" y toma el día', async () => {
    const day = await secondBookableDay('DAY')
    renderWidget({ key: 1, unit: 'DAY', date: day.date, startAt: null })

    expect(await screen.findByText(/Día completo:/)).toHaveTextContent('09:00 a 21:00')
    expect(screen.getByRole('radio', { name: 'Por día' })).toBeChecked()
    expect(screen.getByRole('combobox', { name: 'Día' })).toHaveValue(day.date)
    expect(screen.getByRole('region', { name: 'Desglose del precio' })).toHaveTextContent('Total$132.000')
  })

  it('si el bloque ya no está libre deja el día elegido y ninguna hora marcada', async () => {
    const day = await secondBookableDay()
    renderWidget({ key: 1, unit: 'HOUR', date: day.date, startAt: '2020-01-01T12:00:00.000Z' })

    expect(await screen.findByRole('combobox', { name: 'Día' })).toHaveValue(day.date)
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Reservar' })).toBeDisabled()
  })

  it('ignora una elección en una unidad que el espacio no ofrece', async () => {
    const day = await secondBookableDay()
    renderWidget({ key: 1, unit: 'DAY', date: day.date, startAt: null }, { pricePerHour: 18000, pricePerDay: null })

    expect(await screen.findByRole('combobox', { name: 'Día' })).not.toHaveValue(day.date)
    expect(screen.queryByText(/Día completo:/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reservar' })).toBeDisabled()
  })

  it('sin elección previa no marca nada', async () => {
    renderWidget(undefined)

    await screen.findByRole('combobox', { name: 'Día' })
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
  })
})
