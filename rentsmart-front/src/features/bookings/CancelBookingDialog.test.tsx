import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { http as mswHttp, HttpResponse } from 'msw'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '../../lib/http'
import { setToken } from '../../lib/token'
import { server } from '../../mocks/server'
import { CancelBookingDialog } from './CancelBookingDialog'
import type { CancellableBooking, CancelledBy } from './cancellation'
import type { Booking, BookingCheckout, BookingStatus } from './types'

const HOUR = 3_600_000
const inHours = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString()
const fake = (status: BookingStatus, hours = 72): CancellableBooking => ({ id: 'b1', status, startAt: inHours(hours) })

beforeEach(() => setToken('mock-token'))

/** Una reserva pendiente en la API simulada. */
async function pending(): Promise<Booking> {
  const { bookingId } = await http.post<BookingCheckout>('/bookings', {
    spaceId: 'seed-space-1', startAt: '2026-10-12T13:00:00.000Z', endAt: '2026-10-12T15:00:00.000Z', unit: 'HOUR',
  })
  return http.get<Booking>(`/bookings/${bookingId}`)
}

function open(booking: CancellableBooking, cancelledBy: CancelledBy = 'RENTER', total?: number) {
  const onClose = vi.fn()
  const onCancelled = vi.fn()
  render(<CancelBookingDialog booking={booking} cancelledBy={cancelledBy} total={total} onClose={onClose} onCancelled={onCancelled} />)
  return { onClose, onCancelled }
}

const reason = () => screen.getByRole('textbox', { name: 'Motivo' })
const confirm = () => userEvent.click(screen.getByRole('button', { name: 'Cancelar reserva' }))

/** Guarda los cuerpos de las cancelaciones que recibe la API simulada. */
function captureCancels() {
  const bodies: unknown[] = []
  server.events.on('request:start', ({ request }) => {
    if (request.url.endsWith('/cancel')) void request.clone().json().then((body) => bodies.push(body))
  })
  return bodies
}

describe('CancelBookingDialog', () => {
  it('sin reserva no se muestra', () => {
    render(<CancelBookingDialog booking={null} cancelledBy="RENTER" onClose={vi.fn()} onCancelled={vi.fn()} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('con una reserva se abre con el foco en el motivo', () => {
    open(fake('CONFIRMED'))

    expect(screen.getByRole('dialog', { name: '¿Cancelar la reserva?' })).toBeInTheDocument()
    expect(reason()).toHaveFocus()
    expect(screen.getByText('Lo verá el propietario.')).toBeInTheDocument()
  })

  describe('explica qué pasa con el pago (P-14)', () => {
    it('el arrendatario, con más de 24 horas: reembolso total con el monto', () => {
      open(fake('CONFIRMED', 72), 'RENTER', 26400)

      expect(screen.getByText(/Faltan más de 24 horas para el inicio: se te reembolsa el total \(\$26\.400\)\./)).toBeInTheDocument()
    })

    it('el arrendatario, con menos de 24 horas: sin reembolso', () => {
      open(fake('CONFIRMED', 5), 'RENTER', 26400)

      expect(screen.getByText(/Faltan menos de 24 horas para el inicio: si la cancelas no hay reembolso\./)).toBeInTheDocument()
    })

    it('el propietario, aunque falten menos de 24 horas: reembolso total al arrendatario', () => {
      open(fake('CONFIRMED', 5), 'OWNER')

      expect(screen.getByText(/Al cancelarla, el arrendatario recibe el reembolso total\./)).toBeInTheDocument()
      expect(screen.getByText('Lo verá el arrendatario.')).toBeInTheDocument()
    })

    it('una reserva pendiente no tiene pago: solo se libera el horario', () => {
      open(fake('PENDING'))

      expect(screen.getByText(/Todavía no pagas esta reserva: al cancelarla se libera el horario\./)).toBeInTheDocument()
    })
  })

  it('sin motivo, o con uno muy corto, muestra el error y no llama a la API', async () => {
    const cancels = captureCancels()
    const { onCancelled } = open(fake('CONFIRMED'))

    await confirm()

    expect(reason()).toHaveAttribute('aria-invalid', 'true')
    expect(reason()).toHaveAccessibleDescription('Escribe el motivo de la cancelación.')

    await userEvent.type(reason(), 'nada')
    expect(reason()).toHaveAccessibleDescription('El motivo debe tener al menos 5 caracteres.')
    await confirm()

    expect(cancels).toEqual([])
    expect(onCancelled).not.toHaveBeenCalled()
  })

  it('con un motivo válido cancela, manda el motivo sin espacios de sobra y entrega la reserva cancelada', async () => {
    const cancels = captureCancels()
    const booking = await pending()
    const { onCancelled } = open(booking)

    await userEvent.type(reason(), '  Se suspendió la reunión  ')
    await confirm()

    await waitFor(() => expect(onCancelled).toHaveBeenCalledTimes(1))
    expect(onCancelled).toHaveBeenCalledWith(expect.objectContaining({ id: booking.id, status: 'CANCELLED' }))
    expect(cancels).toEqual([{ reason: 'Se suspendió la reunión' }])
  })

  it('se envía también con Enter desde el teclado', async () => {
    const booking = await pending()
    const { onCancelled } = open(booking)

    await userEvent.type(reason(), 'Se suspendió la reunión')
    await userEvent.tab()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Cancelar reserva' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')

    await waitFor(() => expect(onCancelled).toHaveBeenCalledTimes(1))
  })

  it('si el servidor la rechaza muestra el motivo, conserva lo escrito y deja reintentar', async () => {
    server.use(
      mswHttp.post('*/api/bookings/:id/cancel', () =>
        HttpResponse.json({ statusCode: 409, error: 'Conflict', message: 'Una reserva en estado FINISHED no se puede cancelar' }, { status: 409 }),
      ),
    )
    const { onCancelled } = open(fake('CONFIRMED'))
    await userEvent.type(reason(), 'Se suspendió la reunión')

    await confirm()

    expect(await screen.findByRole('alert')).toHaveTextContent('Una reserva en estado FINISHED no se puede cancelar')
    expect(reason()).toHaveValue('Se suspendió la reunión')
    expect(screen.getByRole('button', { name: 'Cancelar reserva' })).toBeEnabled()
    expect(onCancelled).not.toHaveBeenCalled()
  })

  it('"Volver" cierra sin cancelar', async () => {
    const cancels = captureCancels()
    const { onClose } = open(fake('CONFIRMED'))

    await userEvent.click(screen.getByRole('button', { name: 'Volver' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(cancels).toEqual([])
  })

  it('al abrirlo para otra reserva parte con el motivo en blanco', async () => {
    function Harness() {
      const [booking, setBooking] = useState<CancellableBooking | null>(fake('CONFIRMED'))
      return (
        <>
          <button type="button" onClick={() => setBooking({ ...fake('CONFIRMED'), id: 'b2' })}>Otra</button>
          <CancelBookingDialog booking={booking} cancelledBy="RENTER" onClose={() => setBooking(null)} onCancelled={vi.fn()} />
        </>
      )
    }
    render(<Harness />)
    await userEvent.type(reason(), 'Se suspendió la reunión')
    await userEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Otra' }))

    expect(reason()).toHaveValue('')
  })

  it('no tiene problemas de accesibilidad que axe detecte, tampoco con el error a la vista', async () => {
    open(fake('CONFIRMED'), 'RENTER', 26400)
    await confirm()

    const { violations } = await axe.run(document.body, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      rules: { 'color-contrast': { enabled: false }, 'target-size': { enabled: false } },
    })

    expect(violations.map((violation) => violation.id)).toEqual([])
  })
})
