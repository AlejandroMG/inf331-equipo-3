import { useState, type FormEvent } from 'react'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { Textarea } from '../../components/Textarea'
import { formatClp } from '../../lib/format'
import { cancelBooking } from './bookings-api'
import { MAX_CANCEL_REASON, reasonError, refundsOnCancel, type CancellableBooking, type CancelledBy } from './cancellation'
import type { Booking } from './types'

interface CancelBookingDialogProps {
  /** La reserva que se va a cancelar; null mantiene el diálogo cerrado. */
  booking: CancellableBooking | null
  /** Quién cancela: de eso depende el reembolso (P-14). */
  cancelledBy: CancelledBy
  /** CLP enteros que pagó el arrendatario, para mostrar el monto del reembolso; el panel del propietario no lo tiene. */
  total?: number
  onClose: () => void
  /** Se llama con la reserva ya cancelada; quien lo usa actualiza su lista y cierra el diálogo. */
  onCancelled: (booking: Booking) => void
}

/** Diálogo para cancelar una reserva con motivo (RE-05). Explica qué pasa con el pago antes de confirmar. */
export function CancelBookingDialog({ booking, cancelledBy, total, onClose, onCancelled }: CancelBookingDialogProps) {
  return (
    <Modal open={booking !== null} onClose={onClose} title="¿Cancelar la reserva?">
      {/* El formulario se monta con cada reserva: así el motivo y los errores parten en blanco. */}
      {booking && (
        <CancelForm key={booking.id} booking={booking} cancelledBy={cancelledBy} total={total} onClose={onClose} onCancelled={onCancelled} />
      )}
    </Modal>
  )
}

interface CancelFormProps extends Omit<CancelBookingDialogProps, 'booking'> {
  booking: CancellableBooking
}

function consequence(booking: CancellableBooking, cancelledBy: CancelledBy, total: number | undefined, now: Date): string {
  const amount = total === undefined ? '' : ` (${formatClp(total)})`
  if (booking.status !== 'CONFIRMED') {
    return cancelledBy === 'RENTER'
      ? 'Todavía no pagas esta reserva: al cancelarla se libera el horario.'
      : 'El arrendatario todavía no paga esta reserva: al cancelarla se libera el horario.'
  }
  if (cancelledBy === 'OWNER') return `Al cancelarla, el arrendatario recibe el reembolso total${amount}.`
  return refundsOnCancel(booking, cancelledBy, now)
    ? `Faltan más de 24 horas para el inicio: se te reembolsa el total${amount}.`
    : 'Faltan menos de 24 horas para el inicio: si la cancelas no hay reembolso.'
}

function CancelForm({ booking, cancelledBy, total, onClose, onCancelled }: CancelFormProps) {
  const [now] = useState(() => new Date())
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const [sending, setSending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const invalid = reasonError(reason)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setTried(true)
    if (invalid) return
    setSending(true)
    setServerError(null)
    try {
      onCancelled(await cancelBooking(booking.id, reason.trim()))
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'No pudimos cancelar la reserva. Intenta de nuevo.')
      setSending(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4 text-ink">
      <p className="text-muted">{consequence(booking, cancelledBy, total, now)} Esta acción no se puede deshacer.</p>
      <Textarea
        label="Motivo"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={MAX_CANCEL_REASON}
        required
        autoFocus
        error={tried ? (invalid ?? undefined) : undefined}
        hint={cancelledBy === 'OWNER' ? 'Lo verá el arrendatario.' : 'Lo verá el propietario.'}
      />
      {serverError && (
        <p role="alert" className="rounded-card bg-accent-soft p-3 text-[15px] font-semibold text-accent-ink">
          {serverError}
        </p>
      )}
      <div className="mt-2 flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={sending}>
          Volver
        </Button>
        <Button type="submit" loading={sending}>
          Cancelar reserva
        </Button>
      </div>
    </form>
  )
}
