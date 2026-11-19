import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetMockBookings } from '../../mocks/bookings-handlers'
import { server } from '../../mocks/server'
import { AvailabilityCalendar, type AvailabilityCalendarProps } from './AvailabilityCalendar'
import type { ScheduleRule } from './types'

// Contra el mock de MSW: los espacios simulados se arriendan de lunes a viernes de 09:00 a 21:00, las horas que ya
// pasaron siguen libres y los miércoles de 13:00 a 14:00 están ocupados.
const SPACE = 'seed-space-2'
const WEEKDAYS: ScheduleRule[] = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: '09:00', endTime: '21:00' }))

function renderCalendar(props: Partial<AvailabilityCalendarProps> = {}) {
  const onPick = vi.fn()
  render(
    <AvailabilityCalendar
      spaceId={SPACE}
      schedule={WEEKDAYS}
      pricePerHour={18000}
      pricePerDay={120000}
      onPick={onPick}
      {...props}
    />,
  )
  return onPick
}

const freeBlocks = () => screen.queryAllByRole('button', { name: /: libre$/ })

describe('AvailabilityCalendar', () => {
  afterEach(() => resetMockBookings())

  it('carga y muestra una semana con la leyenda y los bloques de cada día', async () => {
    renderCalendar()

    expect(screen.getByRole('status', { name: 'Cargando el calendario' })).toBeInTheDocument()
    expect((await screen.findAllByRole('button', { name: /: libre$/ })).length).toBeGreaterThan(0)

    expect(screen.queryByRole('status', { name: 'Cargando el calendario' })).not.toBeInTheDocument()
    const legend = screen.getByRole('list', { name: 'Leyenda' })
    expect(within(legend).getByText('Libre')).toBeInTheDocument()
    expect(within(legend).getByText('Ocupado')).toBeInTheDocument()
    // Siete días, y los fines de semana no se arriendan.
    const week = screen.getByRole('list', { name: /^Disponibilidad del / })
    expect(within(week).getAllByRole('heading', { level: 3 })).toHaveLength(7)
    expect(within(week).getAllByText('No se arrienda este día.').length).toBeGreaterThanOrEqual(2)
  })

  it('al tocar un bloque libre avisa el día y el instante UTC del bloque', async () => {
    const user = userEvent.setup()
    const onPick = renderCalendar()

    const [first] = await screen.findAllByRole('button', { name: /: libre$/ })
    await user.click(first)

    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick).toHaveBeenCalledWith({
      unit: 'HOUR',
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      startAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00(\.000)?Z$/),
    })
  })

  it('muestra el bloque ocupado desactivado y sin avisar nada al tocarlo', async () => {
    const user = userEvent.setup()
    const onPick = renderCalendar()
    await screen.findAllByRole('button', { name: /: libre$/ })

    // Los miércoles de 13:00 a 14:00 están ocupados: dentro de dos semanas hay al menos uno.
    const busy = () => screen.queryAllByRole('button', { name: /13:00 a 14:00: ocupado$/ })
    const found = [...busy()]
    await user.click(screen.getByRole('button', { name: 'Semana siguiente' }))
    found.push(...busy())

    expect(found.length).toBeGreaterThanOrEqual(1)
    expect(found[0]).toBeDisabled()
    await user.click(found[0])
    expect(onPick).not.toHaveBeenCalled()
  })

  it('navega entre las dos semanas y no deja salirse de ese rango', async () => {
    const user = userEvent.setup()
    renderCalendar()
    await screen.findAllByRole('button', { name: /: libre$/ })
    const previous = screen.getByRole('button', { name: 'Semana anterior' })
    const next = screen.getByRole('button', { name: 'Semana siguiente' })
    const range = () => screen.getByText(/^\d{1,2} \w+\.? – \d{1,2} \w+\.?$/).textContent

    expect(previous).toBeDisabled()
    expect(next).toBeEnabled()
    const firstWeek = range()

    await user.click(next)
    expect(range()).not.toBe(firstWeek)
    expect(next).toBeDisabled()
    expect(previous).toBeEnabled()

    await user.click(previous)
    expect(range()).toBe(firstWeek)
  })

  it('si el espacio solo se arrienda por día, ofrece un botón de día completo por día', async () => {
    const user = userEvent.setup()
    const onPick = renderCalendar({ pricePerHour: null, pricePerDay: 90000 })

    const [first] = await screen.findAllByRole('button', { name: /, día completo: libre$/ })
    expect(screen.queryByRole('button', { name: /09:00 a 10:00/ })).not.toBeInTheDocument()
    await user.click(first)

    expect(onPick).toHaveBeenCalledWith({ unit: 'DAY', date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), startAt: null })
  })

  it('no dibuja nada si el espacio no tiene precio', async () => {
    const { container } = render(
      <AvailabilityCalendar spaceId={SPACE} schedule={WEEKDAYS} pricePerHour={null} pricePerDay={null} onPick={vi.fn()} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('no dibuja nada si el espacio no tiene disponibilidad publicada (404)', async () => {
    const { container } = render(
      <AvailabilityCalendar spaceId="no-existe" schedule={WEEKDAYS} pricePerHour={18000} pricePerDay={null} onPick={vi.fn()} />,
    )

    await waitFor(() => expect(screen.queryByRole('status', { name: 'Cargando el calendario' })).not.toBeInTheDocument())
    expect(container).toBeEmptyDOMElement()
  })

  it('si falla la carga lo dice y permite reintentar', async () => {
    const user = userEvent.setup()
    let calls = 0
    server.use(
      http.get('*/api/spaces/:id/availability', () => {
        calls += 1
        return calls === 1
          ? HttpResponse.json({ statusCode: 500, error: 'Internal Server Error', message: 'Falló el servidor' }, { status: 500 })
          : undefined
      }),
    )
    renderCalendar()

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar el calendario.')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    await waitFor(() => expect(freeBlocks().length).toBeGreaterThan(0))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
