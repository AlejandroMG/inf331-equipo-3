import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Button, LinkButton } from '../../components/Button'
import { cn } from '../../lib/cn'
import { formatClp } from '../../lib/format'
import { ApiError } from '../../lib/http'
import { usePageTitle } from '../../lib/page-title'
import { paths } from '../../lib/paths'
import { useRequest } from '../../lib/useRequest'
import { FEE_PERCENT, formatRange, formatTime, hoursBetween, remainingLabel, STATUS_LABELS } from './booking-selection'
import { getBooking } from './bookings-api'
import type { Booking, BookingStatus } from './types'
import { useConfirmationPolling } from './useConfirmationPolling'

const STATUS_CLASSES: Record<BookingStatus, string> = {
  PENDING: 'bg-accent-soft text-accent-ink',
  PAID: 'bg-primary-soft text-primary-dark',
  CONFIRMED: 'bg-primary text-white',
  FINISHED: 'bg-line text-ink',
  CANCELLED: 'bg-line text-ink',
  EXPIRED: 'bg-line text-ink',
}

/** La hora actual, actualizada cada segundo. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

/** Cuánto le queda a la retención del horario de una reserva `PENDING` (P-06). */
function HoldCountdown({ booking }: { booking: Booking }) {
  const now = useNow()
  const remaining = booking.expiresAt ? remainingLabel(booking.expiresAt, now) : null

  if (!booking.expiresAt) return null
  if (!remaining) {
    return (
      <div className="rounded-xl border border-accent bg-accent-soft p-4 text-[15px] text-accent-ink">
        <p className="font-semibold">La retención del horario venció.</p>
        <p className="mt-1">El horario quedó libre para otros. Si todavía lo necesitas, vuelve a reservarlo.</p>
        <LinkButton to={paths.space(booking.space.id)} variant="secondary" size="sm" className="mt-3">
          Volver al espacio
        </LinkButton>
      </div>
    )
  }
  return (
    <div className="rounded-xl bg-primary-soft p-4 text-[15px]">
      <p>
        Tu horario queda retenido por <span className="font-bold tabular-nums">{remaining}</span> minutos mientras pagas.
      </p>
      <p className="mt-1 text-sm text-muted">Si no se paga a tiempo, la reserva vence y el horario queda libre.</p>
    </div>
  )
}

/** Cómo volvió el arrendatario de Stripe Checkout: `?pago=ok` (success_url) o `?pago=cancelado` (cancel_url). */
type PaymentReturn = 'ok' | 'cancelado' | null

function paymentReturnOf(value: string | null): PaymentReturn {
  return value === 'ok' || value === 'cancelado' ? value : null
}

/**
 * Volvió de Stripe sin pagar: el horario sigue retenido mientras la reserva no venza. No hay un enlace para volver a
 * pagar (la API no expone la URL de la sesión; pendiente para PA-02), así que el aviso dice cómo seguir.
 */
function CancelledPaymentNotice({ booking }: { booking: Booking }) {
  const now = useNow()
  if (booking.status !== 'PENDING' || !booking.expiresAt || !remainingLabel(booking.expiresAt, now)) return null
  return (
    <div role="status" className="rounded-xl border border-accent bg-accent-soft p-4 text-[15px] text-accent-ink">
      Cancelaste el pago. El horario sigue retenido hasta las {formatTime(booking.expiresAt)}; puedes volver atrás a la
      página de pago o esperar a que venza para elegir otro.
    </div>
  )
}

function BookingDetail({
  booking: initial,
  payment,
  onRefresh,
}: {
  booking: Booking
  payment: PaymentReturn
  onRefresh: () => void
}) {
  // Al volver de pagar, consulta hasta ver la reserva confirmada (PA-01).
  const { booking, polling, exhausted } = useConfirmationPolling(initial, payment === 'ok')
  const hours = hoursBetween(booking.startAt, booking.endAt)
  const { space } = booking

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted">Tu reserva en</p>
        <h1 className="font-display text-3xl font-bold leading-tight">
          <Link to={paths.space(space.id)} className="hover:underline">
            {space.name}
          </Link>
        </h1>
        <p className="mt-1 text-[15px] text-muted">{[space.address, space.communeName].filter(Boolean).join(', ')}</p>
        {space.addressDetail && <p className="mt-1 text-[15px]">{space.addressDetail}</p>}
      </div>

      <p className="flex flex-wrap items-center gap-2 text-[15px]">
        Estado:
        <span className={cn('rounded-full px-3 py-0.5 text-sm font-bold', STATUS_CLASSES[booking.status])}>
          {STATUS_LABELS[booking.status]}
        </span>
      </p>

      {polling && (
        <div role="status" className="flex items-center gap-3 rounded-xl bg-primary-soft p-4 text-[15px]">
          <span aria-hidden="true" className="size-4 shrink-0 rounded-full border-2 border-primary border-t-transparent motion-safe:animate-spin" />
          Pago recibido, confirmando tu reserva…
        </div>
      )}
      {exhausted && (
        <div role="status" className="rounded-xl border border-accent bg-accent-soft p-4 text-[15px] text-accent-ink">
          Todavía no recibimos la confirmación del pago. Prueba con «Actualizar el estado» en unos minutos.
        </div>
      )}
      {payment === 'cancelado' && <CancelledPaymentNotice booking={booking} />}

      {booking.status === 'PENDING' && !polling && <HoldCountdown booking={booking} />}

      <section aria-labelledby="booking-schedule" className="rounded-card border border-line bg-white p-5">
        <h2 id="booking-schedule" className="mb-2 text-lg font-bold">
          Horario
        </h2>
        <p className="text-[15px]">{formatRange(booking.startAt, booking.endAt)}</p>
        <p className="text-sm text-muted">
          {booking.unit === 'DAY' ? 'Por día, todo el horario de ese día' : `Por hora, ${hours} ${hours === 1 ? 'hora' : 'horas'}`} · hora de
          Chile
        </p>
      </section>

      <section aria-labelledby="booking-amounts" className="rounded-card border border-line bg-white p-5">
        <h2 id="booking-amounts" className="mb-2 text-lg font-bold">
          Desglose
        </h2>
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[15px]">
          <dt className="text-muted">Arriendo</dt>
          <dd className="text-right">{formatClp(booking.subtotal)}</dd>
          <dt className="text-muted">Comisión de servicio ({FEE_PERCENT} %)</dt>
          <dd className="text-right">{formatClp(booking.fee)}</dd>
          <dt className="border-t border-line pt-1 font-bold">Total</dt>
          <dd className="border-t border-line pt-1 text-right font-bold">{formatClp(booking.total)}</dd>
        </dl>
      </section>

      <div>
        <Button variant="secondary" onClick={onRefresh}>
          Actualizar el estado
        </Button>
      </div>
    </div>
  )
}

/**
 * /bookings/:bookingId: una reserva propia, con su estado, horario, desglose y la retención si está pendiente.
 * Stripe Checkout vuelve aquí con `?pago=ok` (se consulta hasta ver la reserva confirmada) o `?pago=cancelado`.
 */
export function BookingPage() {
  const { bookingId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const payment = paymentReturnOf(searchParams.get('pago'))
  const { data: booking, error, loading, retry } = useRequest(bookingId, (signal) => getBooking(bookingId, signal))
  usePageTitle(booking ? `Reserva en ${booking.space.name}` : 'Tu reserva')
  const status = error instanceof ApiError ? error.status : null

  return (
    <div className="mx-auto max-w-[720px] px-4 py-6 sm:px-6 sm:py-8">
      {loading && (
        <div role="status" aria-label="Cargando la reserva" className="flex flex-col gap-4">
          <div className="h-9 w-2/3 motion-safe:animate-pulse rounded bg-line/60" />
          <div className="h-32 motion-safe:animate-pulse rounded-card bg-line/60" />
        </div>
      )}

      {(status === 404 || status === 403) && (
        <div className="flex flex-col items-start gap-4 py-10">
          <h1 className="font-display text-3xl font-bold">
            {status === 404 ? 'No encontramos esta reserva' : 'Esta reserva no es tuya'}
          </h1>
          <p className="max-w-lg text-muted">
            {status === 404 ? 'Puede que el enlace esté incompleto.' : 'Solo quien hizo la reserva puede verla.'}
          </p>
          <LinkButton to={paths.home}>Ver el catálogo</LinkButton>
        </div>
      )}

      {error && status !== 404 && status !== 403 && (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-accent bg-accent-soft p-6 text-accent-ink">
          <p className="font-semibold">No pudimos cargar la reserva.</p>
          <p className="text-sm">{error.message}</p>
          <Button variant="secondary" onClick={retry}>
            Reintentar
          </Button>
        </div>
      )}

      {booking && <BookingDetail booking={booking} payment={payment} onRefresh={retry} />}
    </div>
  )
}
