import { cn } from '../../lib/cn'
import { formatClp } from '../../lib/format'
import { formatBookingRange, STATUS_LABELS } from './booking-format'
import type { BookingStatus, OwnerBooking } from './types'

const STATUS_STYLES: Record<BookingStatus, string> = {
  CONFIRMED: 'bg-primary-soft text-primary-dark',
  FINISHED: 'bg-surface text-ink',
  PAID: 'bg-primary-soft text-primary-dark',
  PENDING: 'bg-accent-soft text-accent-ink',
  CANCELLED: 'bg-surface text-muted',
  EXPIRED: 'bg-surface text-muted',
}

/** Una reserva de uno de mis espacios. El contacto del arrendatario solo existe en las confirmadas. */
export function BookingCard({ booking }: { booking: OwnerBooking }) {
  return (
    <li className="flex flex-col gap-2 rounded-card border border-line bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">{booking.spaceName}</h2>
        <span className={cn('rounded-full px-2.5 py-0.5 text-[13px] font-bold', STATUS_STYLES[booking.status])}>
          {STATUS_LABELS[booking.status]}
        </span>
      </div>
      <p className="text-[15px]">{formatBookingRange(booking.startAt, booking.endAt)}</p>
      <p className="text-[15px] text-muted">
        {booking.renterName} · {formatClp(booking.subtotal)}
        {booking.unit === 'DAY' ? ' · por día' : ''}
      </p>
      {booking.contact && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
          <a href={`mailto:${booking.contact.email}`} className="inline-flex min-h-11 items-center font-semibold text-primary underline">
            {booking.contact.email}
          </a>
          {booking.contact.phone && (
            <a href={`tel:${booking.contact.phone.replace(/\s/g, '')}`} className="inline-flex min-h-11 items-center font-semibold text-primary underline">
              {booking.contact.phone}
            </a>
          )}
        </p>
      )}
    </li>
  )
}
