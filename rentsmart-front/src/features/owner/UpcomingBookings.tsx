import { Link } from 'react-router'
import { formatClp } from '../../lib/format'
import { paths } from '../../lib/paths'
import { useRequest } from '../../lib/useRequest'
import { formatBookingRange, todayInSantiago } from './booking-format'
import { fetchOwnerBookings } from './owner-api'

const SHOWN = 3

/** Las próximas reservas confirmadas de mis espacios, para el panel "Mis espacios" (PN-01). */
export function UpcomingBookings() {
  const today = todayInSantiago()
  const { data, error, loading } = useRequest(`owner-upcoming:${today}`, (signal) =>
    fetchOwnerBookings({ pageSize: SHOWN, filters: { status: 'CONFIRMED', from: today, to: '', sort: 'asc' }, signal }),
  )

  return (
    <>
      {loading && <p className="text-sm text-muted">Cargando tus reservas…</p>}
      {error && <p className="text-sm leading-relaxed text-muted">No pudimos cargar tus próximas reservas.</p>}
      {data && data.items.length === 0 && (
        <p className="text-sm leading-relaxed text-muted">No tienes reservas próximas. Cuando alguien reserve uno de tus espacios, aparecerá aquí.</p>
      )}
      {data && data.items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {data.items.map((booking) => (
            <li key={booking.id} className="rounded-xl bg-surface p-3 text-[15px]">
              <p className="font-semibold">{booking.spaceName}</p>
              <p>{formatBookingRange(booking.startAt, booking.endAt)}</p>
              <p className="text-muted">
                {booking.renterName} · {formatClp(booking.subtotal)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Link to={paths.ownerBookings} className="inline-flex min-h-11 items-center text-[15px] font-semibold text-primary underline">
        Ver todas las reservas
      </Link>
    </>
  )
}
