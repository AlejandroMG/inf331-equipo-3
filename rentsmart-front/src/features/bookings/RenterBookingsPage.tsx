import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button, LinkButton } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { Pagination } from '../../components/Pagination'
import { Select } from '../../components/Select'
import { cn } from '../../lib/cn'
import { formatClp } from '../../lib/format'
import { usePageTitle } from '../../lib/page-title'
import { paths } from '../../lib/paths'
import { useRequest } from '../../lib/useRequest'
import type { Booking, BookingStatus, Payment, PaymentStatus } from './types'
import { canCancel } from './cancellation'
import { CancelBookingDialog } from './CancelBookingDialog'
import { checkoutDestination, formatRange, STATUS_LABELS } from './booking-selection'
import { getMyBookings, getMyPayments, resumeBookingCheckout } from './bookings-api'

const PAGE_SIZE = 20
const STATUS_OPTIONS: Array<{ value: BookingStatus | ''; label: string }> = [
  { value: '', label: 'Todos los estados' },
  { value: 'PENDING', label: STATUS_LABELS.PENDING },
  { value: 'PAID', label: STATUS_LABELS.PAID },
  { value: 'CONFIRMED', label: STATUS_LABELS.CONFIRMED },
  { value: 'FINISHED', label: STATUS_LABELS.FINISHED },
  { value: 'CANCELLED', label: STATUS_LABELS.CANCELLED },
  { value: 'EXPIRED', label: STATUS_LABELS.EXPIRED },
]

const STATUS_STYLES: Record<BookingStatus, string> = {
  PENDING: 'bg-accent-soft text-accent-ink',
  PAID: 'bg-primary-soft text-primary-dark',
  CONFIRMED: 'bg-primary text-white',
  FINISHED: 'bg-surface text-ink',
  CANCELLED: 'bg-surface text-muted',
  EXPIRED: 'bg-surface text-muted',
}

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Pendiente',
  SUCCEEDED: 'Pagado',
  FAILED: 'Fallido',
  REFUNDED: 'Reembolsado',
}

function parsePage(value: string | null): number {
  const page = Number(value)
  return Number.isInteger(page) && page >= 1 ? page : 1
}

function parseStatus(value: string | null): BookingStatus | undefined {
  const status = STATUS_OPTIONS.find((option) => option.value === value)?.value
  return status || undefined
}

function useCurrentTime(): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const update = () => setNow(Date.now())
    update()
    const interval = window.setInterval(update, 30_000)
    return () => window.clearInterval(interval)
  }, [])
  return now
}

function paymentDate(value: string): string {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function bookingCanPay(booking: Booking, now: number): boolean {
  return booking.status === 'PENDING' && booking.expiresAt !== null && Date.parse(booking.expiresAt) > now
}

/** Historial de reservas y pagos del arrendatario (PN-03). */
export function RenterBookingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const tab = searchParams.get('tab') === 'payments' ? 'payments' : 'bookings'
  const status = parseStatus(searchParams.get('status'))
  const page = parsePage(searchParams.get('page'))
  const paymentsPage = parsePage(searchParams.get('paymentsPage'))
  const queryKey = searchParams.toString()
  const bookings = useRequest(`renter-bookings:${queryKey}`, (signal) => getMyBookings(page, status, signal))
  const payments = useRequest(`renter-payments:${queryKey}`, (signal) => getMyPayments(paymentsPage, signal))
  const [canceling, setCanceling] = useState<Booking | null>(null)
  const [receipt, setReceipt] = useState<Payment | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const now = useCurrentTime()
  usePageTitle('Mis reservas y pagos')

  const updateQuery = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setSearchParams(next)
  }

  async function pay(booking: Booking) {
    setPayingId(booking.id)
    setActionError(null)
    try {
      const checkout = await resumeBookingCheckout(booking.id)
      const destination = checkoutDestination(checkout.checkoutUrl, booking.id, window.location.origin)
      if (destination.inApp) navigate(destination.path)
      else window.location.assign(destination.url)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No pudimos abrir el pago. Intenta de nuevo.')
    } finally {
      setPayingId(null)
    }
  }

  const bookingTotalPages = bookings.data ? Math.max(1, Math.ceil(bookings.data.total / PAGE_SIZE)) : 1
  const paymentTotalPages = payments.data ? Math.max(1, Math.ceil(payments.data.total / PAGE_SIZE)) : 1

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">Mis reservas y pagos</h1>
      <p className="mb-6 mt-1.5 text-[15px] text-muted">Consulta el estado de tus reservas, continúa pagos pendientes y revisa tus comprobantes.</p>

      <div role="tablist" aria-label="Mis reservas y pagos" className="mb-6 flex gap-2 border-b border-line">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'bookings'}
          onClick={() => updateQuery({ tab: null, page: null })}
          className={cn('min-h-11 border-b-2 px-4 font-semibold', tab === 'bookings' ? 'border-primary text-primary-dark' : 'border-transparent text-muted')}
        >
          Reservas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'payments'}
          onClick={() => updateQuery({ tab: 'payments', paymentsPage: null })}
          className={cn('min-h-11 border-b-2 px-4 font-semibold', tab === 'payments' ? 'border-primary text-primary-dark' : 'border-transparent text-muted')}
        >
          Historial de pagos
        </button>
      </div>

      {actionError && (
        <div role="alert" className="mb-5 rounded-card border border-accent bg-accent-soft p-4 text-[15px] font-semibold text-accent-ink">
          {actionError}
        </div>
      )}

      {tab === 'bookings' ? (
        <section role="tabpanel" aria-label="Reservas">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div className="w-full sm:max-w-xs">
              <Select
                label="Filtrar por estado"
                value={status ?? ''}
                options={STATUS_OPTIONS}
                onChange={(event) => updateQuery({ status: event.target.value || null, page: null })}
              />
            </div>
            {status && (
              <Button variant="secondary" onClick={() => updateQuery({ status: null, page: null })}>
                Limpiar filtro
              </Button>
            )}
          </div>

          {bookings.loading && <p role="status" className="text-muted">Cargando tus reservas…</p>}
          {bookings.error && (
            <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-accent bg-accent-soft p-6 text-accent-ink">
              <p className="font-semibold">No pudimos cargar tus reservas.</p>
              <p className="text-sm">{bookings.error.message}</p>
              <Button variant="secondary" onClick={bookings.retry}>Reintentar</Button>
            </div>
          )}
          {bookings.data && bookings.data.items.length === 0 && (
            <div className="rounded-card border border-dashed border-line bg-white px-6 py-12 text-center">
              <h2 className="font-display text-xl font-bold">{status ? 'No tienes reservas con ese estado' : 'Todavía no tienes reservas'}</h2>
              <p className="mt-2 text-muted">{status ? 'Prueba con otro filtro.' : 'Cuando reserves un espacio, aparecerá aquí.'}</p>
              {!status && <LinkButton to={paths.home} className="mt-4">Explorar espacios</LinkButton>}
            </div>
          )}
          {bookings.data && bookings.data.items.length > 0 && (
            <>
              <p className="mb-3 text-[15px] text-muted" aria-live="polite">
                {bookings.data.total === 1 ? '1 reserva' : `${bookings.data.total} reservas`}
              </p>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                {bookings.data.items.map((booking) => {
                  const canPay = now !== null && bookingCanPay(booking, now)
                  const canCancelNow = canCancel(booking.status) && (booking.status !== 'PENDING' || canPay)
                  return (
                    <li key={booking.id} className="flex flex-col gap-3 rounded-card border border-line bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="font-display text-lg font-bold">{booking.space.name}</h2>
                          <p className="text-sm text-muted">{[booking.space.communeName, booking.space.address].filter(Boolean).join(', ') || 'Ubicación no disponible'}</p>
                        </div>
                        <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-[13px] font-bold', STATUS_STYLES[booking.status])}>
                          {STATUS_LABELS[booking.status]}
                        </span>
                      </div>
                      {booking.space.coverUrl && <img src={booking.space.coverUrl} alt="" className="h-40 w-full rounded-control object-cover" />}
                      <p className="text-[15px]">{formatRange(booking.startAt, booking.endAt)}</p>
                      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[15px]">
                        <dt className="text-muted">Arriendo</dt><dd>{formatClp(booking.subtotal)}</dd>
                        <dt className="text-muted">Comisión</dt><dd>{formatClp(booking.fee)}</dd>
                        <dt className="font-bold">Total</dt><dd className="font-bold">{formatClp(booking.total)}</dd>
                      </dl>
                      <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-3">
                        {canPay && (
                          <Button onClick={() => void pay(booking)} loading={payingId === booking.id} disabled={payingId !== null}>
                            Pagar
                          </Button>
                        )}
                        <LinkButton to={paths.booking(booking.id)} variant="secondary">Ver reserva</LinkButton>
                        {canCancelNow && (
                          <Button variant="outline" onClick={() => setCanceling(booking)}>
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
              <div className="mt-8">
                <Pagination
                  page={bookings.data.page}
                  totalPages={bookingTotalPages}
                  hrefFor={(nextPage) => {
                    const next = new URLSearchParams(searchParams)
                    if (nextPage === 1) next.delete('page')
                    else next.set('page', String(nextPage))
                    return `?${next}`
                  }}
                />
              </div>
            </>
          )}
        </section>
      ) : (
        <section role="tabpanel" aria-label="Historial de pagos">
          {payments.loading && <p role="status" className="text-muted">Cargando tus pagos…</p>}
          {payments.error && (
            <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-accent bg-accent-soft p-6 text-accent-ink">
              <p className="font-semibold">No pudimos cargar tus pagos.</p>
              <p className="text-sm">{payments.error.message}</p>
              <Button variant="secondary" onClick={payments.retry}>Reintentar</Button>
            </div>
          )}
          {payments.data && payments.data.items.length === 0 && (
            <div className="rounded-card border border-dashed border-line bg-white px-6 py-12 text-center">
              <h2 className="font-display text-xl font-bold">Todavía no tienes pagos</h2>
              <p className="mt-2 text-muted">Cuando se registre un pago de una reserva, podrás consultar aquí su comprobante.</p>
            </div>
          )}
          {payments.data && payments.data.items.length > 0 && (
            <>
              <p className="mb-3 text-[15px] text-muted">{payments.data.total === 1 ? '1 pago' : `${payments.data.total} pagos`}</p>
              <ul className="flex flex-col gap-3">
                {payments.data.items.map((payment) => (
                  <PaymentCard key={payment.id} payment={payment} onReceipt={() => setReceipt(payment)} />
                ))}
              </ul>
              <div className="mt-8">
                <Pagination
                  page={payments.data.page}
                  totalPages={paymentTotalPages}
                  hrefFor={(nextPage) => {
                    const next = new URLSearchParams(searchParams)
                    next.set('tab', 'payments')
                    if (nextPage === 1) next.delete('paymentsPage')
                    else next.set('paymentsPage', String(nextPage))
                    return `?${next}`
                  }}
                />
              </div>
            </>
          )}
        </section>
      )}

      <CancelBookingDialog
        booking={canceling}
        cancelledBy="RENTER"
        total={canceling?.total}
        onClose={() => setCanceling(null)}
        onCancelled={() => {
          setCanceling(null)
          bookings.retry()
          payments.retry()
        }}
      />
      <ReceiptDialog payment={receipt} onClose={() => setReceipt(null)} />
    </div>
  )
}

function PaymentCard({ payment, onReceipt }: { payment: Payment; onReceipt: () => void }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-white p-4 sm:p-5">
      <div className="min-w-0">
        <h2 className="font-display text-lg font-bold">{payment.spaceName}</h2>
        <p className="text-sm text-muted">{paymentDate(payment.createdAt)} · Reserva {payment.bookingId.slice(0, 8)}</p>
        <p className="mt-1 text-[15px]">Total: <strong>{formatClp(payment.amount)}</strong> · Comisión: {formatClp(payment.fee)}</p>
        {payment.refundedAmount > 0 && <p className="text-sm text-muted">Reembolso: {formatClp(payment.refundedAmount)}</p>}
        <p className="mt-1 text-sm font-semibold">{PAYMENT_LABELS[payment.status]}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <LinkButton to={paths.booking(payment.bookingId)} variant="secondary">Ver reserva</LinkButton>
        {(payment.status === 'SUCCEEDED' || payment.status === 'REFUNDED') && (
          <Button variant="outline" onClick={onReceipt}>Ver comprobante</Button>
        )}
      </div>
    </li>
  )
}

function ReceiptDialog({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  return (
    <Modal
      open={payment !== null}
      onClose={onClose}
      title="Comprobante de pago"
      printable
      footer={payment ? (
        <div className="receipt-print-actions flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
          <Button onClick={() => window.print()}>Imprimir o guardar como PDF</Button>
        </div>
      ) : undefined}
    >
      {payment && (
        <div className="flex flex-col gap-4 text-ink">
          <p className="text-sm text-muted">Comprobante informativo de RentSmart</p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-[15px]">
            <dt className="text-muted">Espacio</dt><dd className="text-right font-semibold">{payment.spaceName}</dd>
            <dt className="text-muted">Fecha</dt><dd className="text-right">{paymentDate(payment.createdAt)}</dd>
            <dt className="text-muted">ID de pago</dt><dd className="text-right font-mono text-xs">{payment.id}</dd>
            <dt className="text-muted">ID de reserva</dt><dd className="text-right font-mono text-xs">{payment.bookingId}</dd>
            <dt className="border-t border-line pt-2 text-muted">Arriendo</dt><dd className="border-t border-line pt-2 text-right">{formatClp(payment.amount - payment.fee)}</dd>
            <dt className="text-muted">Comisión</dt><dd className="text-right">{formatClp(payment.fee)}</dd>
            <dt className="font-bold">Total pagado</dt><dd className="text-right font-bold">{formatClp(payment.amount)}</dd>
            {payment.refundedAmount > 0 && <><dt className="text-muted">Reembolsado</dt><dd className="text-right">{formatClp(payment.refundedAmount)}</dd></>}
          </dl>
          <p className="text-xs leading-relaxed text-muted">Este comprobante resume la información registrada por RentSmart; no reemplaza un comprobante tributario emitido por el proveedor de pago.</p>
        </div>
      )}
    </Modal>
  )
}
