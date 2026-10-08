import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { http as mswHttp, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setToken } from '../../lib/token'
import { server } from '../../mocks/server'
import { WeeklySchedule } from './WeeklySchedule'

// La API simulada (bookings-handlers.ts) parte sin horario en un borrador y con lunes a viernes de 09:00 a
// 21:00 en los espacios del catálogo.
const DRAFT = 'draft-1'
const WITH_SCHEDULE = 'seed-space-1'

beforeEach(() => setToken('mock-token'))

async function open(spaceId = DRAFT, onSaved?: () => void) {
  const view = render(<WeeklySchedule spaceId={spaceId} onSaved={onSaved} />)
  await screen.findByRole('button', { name: 'Guardar horario' })
  return view
}

const day = (name: string) => within(screen.getByRole('group', { name }))
const checkbox = (name: string) => day(name).getByRole('checkbox', { name: new RegExp(name) })
const from = (name: string, n = 1) => screen.getByRole('combobox', { name: `${name}, rango ${n}, desde` })
const to = (name: string, n = 1) => screen.getByRole('combobox', { name: `${name}, rango ${n}, hasta` })
const save = () => userEvent.click(screen.getByRole('button', { name: 'Guardar horario' }))

/** Guarda los cuerpos de los PUT que recibe la API simulada. */
function capturePuts() {
  const bodies: unknown[] = []
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'PUT') void request.clone().json().then((body) => bodies.push(body))
  })
  return bodies
}

describe('WeeklySchedule', () => {
  it('mientras carga lo avisa, y un borrador parte con los siete días sin arrendar', async () => {
    render(<WeeklySchedule spaceId={DRAFT} />)
    expect(screen.getByRole('status')).toHaveTextContent('Cargando horario…')

    await screen.findByRole('button', { name: 'Guardar horario' })

    expect(screen.getAllByRole('group').map((group) => within(group).getByRole('checkbox'))).toHaveLength(7)
    expect(screen.getAllByRole('checkbox').every((box) => !(box as HTMLInputElement).checked)).toBe(true)
    expect(screen.getAllByText('No se arrienda')).toHaveLength(7)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('muestra el horario guardado del espacio', async () => {
    await open(WITH_SCHEDULE)

    expect(checkbox('Lunes')).toBeChecked()
    expect(from('Lunes')).toHaveValue('09:00')
    expect(to('Lunes')).toHaveValue('21:00')
    expect(checkbox('Sábado')).not.toBeChecked()
    expect(checkbox('Domingo')).not.toBeChecked()
  })

  it('activar un día le pone un rango de 09:00 a 18:00 y desactivarlo se lo quita', async () => {
    await open()

    await userEvent.click(checkbox('Martes'))

    expect(from('Martes')).toHaveValue('09:00')
    expect(to('Martes')).toHaveValue('18:00')
    expect(screen.getByText('Tienes cambios sin guardar.')).toBeInTheDocument()

    await userEvent.click(checkbox('Martes'))

    expect(day('Martes').queryByRole('combobox')).not.toBeInTheDocument()
    expect(day('Martes').getByText('No se arrienda')).toBeInTheDocument()
  })

  it('guarda varios rangos por día con las horas elegidas y avisa que quedó guardado', async () => {
    const puts = capturePuts()
    const onSaved = vi.fn()
    const view = await open(DRAFT, onSaved)

    await userEvent.click(checkbox('Lunes'))
    await userEvent.selectOptions(to('Lunes'), '13:00')
    await userEvent.click(day('Lunes').getByRole('button', { name: 'Agregar otro rango el lunes' }))
    await userEvent.selectOptions(from('Lunes', 2), '15:00')
    await userEvent.selectOptions(to('Lunes', 2), '24:00')
    await userEvent.click(checkbox('Domingo'))
    await save()

    const rules = [
      { weekday: 1, startTime: '09:00', endTime: '13:00' },
      { weekday: 1, startTime: '15:00', endTime: '24:00' },
      { weekday: 0, startTime: '09:00', endTime: '18:00' },
    ]
    expect(await screen.findByText('Horario guardado.')).toBeInTheDocument()
    expect(puts).toEqual([{ rules }])
    expect(onSaved).toHaveBeenCalledWith({ rules: [rules[2], rules[0], rules[1]] })

    // Al volver a abrirlo, el horario viene del servidor.
    view.unmount()
    await open()
    expect(to('Lunes', 2)).toHaveValue('24:00')
    expect(checkbox('Domingo')).toBeChecked()
  })

  it('el rango nuevo parte donde termina el anterior, y se puede quitar', async () => {
    await open()
    await userEvent.click(checkbox('Viernes'))

    await userEvent.click(day('Viernes').getByRole('button', { name: 'Agregar otro rango el viernes' }))

    expect(from('Viernes', 2)).toHaveValue('18:00')
    expect(to('Viernes', 2)).toHaveValue('19:00')

    await userEvent.click(screen.getByRole('button', { name: 'Quitar el rango 1 del viernes' }))

    expect(from('Viernes')).toHaveValue('18:00')
    expect(screen.queryByRole('combobox', { name: 'Viernes, rango 2, desde' })).not.toBeInTheDocument()
    // Con un solo rango, el día se desactiva con su casilla: no hay "Quitar".
    expect(day('Viernes').queryByRole('button', { name: /Quitar/ })).not.toBeInTheDocument()
  })

  it('un día que llega a las 24:00 no deja agregar otro rango', async () => {
    await open()
    await userEvent.click(checkbox('Sábado'))

    await userEvent.selectOptions(to('Sábado'), '24:00')

    expect(day('Sábado').queryByRole('button', { name: /Agregar/ })).not.toBeInTheDocument()
  })

  it('con un fin que no es posterior al inicio muestra el error, no guarda y lleva el foco al campo', async () => {
    const puts = capturePuts()
    await open()
    await userEvent.click(checkbox('Lunes'))

    await userEvent.selectOptions(to('Lunes'), '09:00')

    const message = day('Lunes').getByText('El fin debe ser posterior al inicio.')
    expect(from('Lunes')).toHaveAttribute('aria-invalid', 'true')
    expect(from('Lunes')).toHaveAttribute('aria-describedby', message.id)

    await save()

    expect(screen.getByRole('alert')).toHaveTextContent('Corrige los rangos marcados antes de guardar.')
    expect(from('Lunes')).toHaveFocus()
    expect(puts).toEqual([])

    // Al corregirlo desaparecen los errores y se puede guardar.
    await userEvent.selectOptions(to('Lunes'), '10:00')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(from('Lunes')).not.toHaveAttribute('aria-invalid')
    await save()
    expect(await screen.findByText('Horario guardado.')).toBeInTheDocument()
  })

  it('dos rangos del mismo día que se traslapan muestran el error; contiguos valen', async () => {
    await open()
    await userEvent.click(checkbox('Jueves'))
    await userEvent.click(day('Jueves').getByRole('button', { name: /Agregar/ }))

    await userEvent.selectOptions(from('Jueves', 2), '17:00')

    expect(day('Jueves').getByText('Los rangos no pueden traslaparse.')).toBeInTheDocument()

    await userEvent.selectOptions(from('Jueves', 2), '18:00')

    expect(day('Jueves').queryByText('Los rangos no pueden traslaparse.')).not.toBeInTheDocument()
  })

  it('muestra el motivo si el servidor rechaza el horario y conserva lo editado', async () => {
    server.use(
      mswHttp.put('*/api/spaces/:id/schedule', () =>
        HttpResponse.json(
          { statusCode: 409, error: 'Conflict', message: 'Un espacio publicado no puede quedar sin horario: desactívalo primero', missing: ['schedule'] },
          { status: 409 },
        ),
      ),
    )
    await open(WITH_SCHEDULE)
    for (const name of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']) await userEvent.click(checkbox(name))

    await save()

    expect(await screen.findByRole('alert')).toHaveTextContent('Un espacio publicado no puede quedar sin horario: desactívalo primero')
    expect(checkbox('Lunes')).not.toBeChecked()
    expect(screen.queryByText('Horario guardado.')).not.toBeInTheDocument()
  })

  it('si no puede cargar el horario lo dice y deja reintentar', async () => {
    server.use(
      mswHttp.get('*/api/spaces/:id/schedule', () => HttpResponse.json({ message: 'Error interno' }, { status: 500 }), { once: true }),
    )
    render(<WeeklySchedule spaceId={WITH_SCHEDULE} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar el horario.')
    expect(screen.queryByRole('button', { name: 'Guardar horario' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    await waitFor(() => expect(checkbox('Lunes')).toBeChecked())
  })

  it('se maneja con teclado: espacio marca el día y el tabulador lleva a sus horas', async () => {
    await open()

    checkbox('Lunes').focus()
    await userEvent.keyboard(' ')
    await userEvent.tab()

    expect(checkbox('Lunes')).toBeChecked()
    expect(from('Lunes')).toHaveFocus()
  })

  it('no tiene problemas de accesibilidad que axe detecte, tampoco con errores a la vista', async () => {
    await open(WITH_SCHEDULE)
    await userEvent.selectOptions(to('Lunes'), '09:00')
    await save()

    const { violations } = await axe.run(document.body, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      rules: { 'color-contrast': { enabled: false }, 'target-size': { enabled: false } },
    })

    expect(violations.map((violation) => violation.id)).toEqual([])
  })
})
