import { useState } from 'react'
import { useLocation, useNavigate, type NavigateFunction } from 'react-router'
import { Button } from '../../components/Button'
import { Select } from '../../components/Select'
import { cn } from '../../lib/cn'
import { formatClp } from '../../lib/format'
import { ApiError } from '../../lib/http'
import { paths } from '../../lib/paths'
import { useToken } from '../../lib/token'
import { useRequest } from '../../lib/useRequest'
import {
  addDays,
  BOOKING_WINDOW_DAYS,
  checkoutDestination,
  estimateAmounts,
  FEE_PERCENT,
  formatDayLabel,
  formatRange,
  formatTime,
  hoursBetween,
  todayInSantiago,
  toggleSlot,
  type SlotRange,
} from './booking-selection'
import { createBooking, getAvailability } from './bookings-api'
import type { AvailabilityDay, BookingUnit } from './types'

export interface BookingWidgetProps {
  spaceId: string
  /** Precios del espacio en CLP; null si no se arrienda en esa unidad. */
  pricePerHour: number | null
  pricePerDay: number | null
}

const UNIT_LABELS: Record<BookingUnit, string> = { HOUR: 'Por hora', DAY: 'Por día' }

/**
 * Lleva al checkout (ver `checkoutDestination`). Si es la página de la reserva, navega dentro de la app a
 * `paths.booking(bookingId)` sin recargar; si es otro sitio (Stripe Checkout, PA-01), cambia de página.
 */
function goToCheckout(checkoutUrl: string, bookingId: string, navigate: NavigateFunction) {
  const destination = checkoutDestination(checkoutUrl, bookingId, window.location.origin)
  if (destination.inApp) navigate(paths.booking(destination.bookingId))
  else window.location.assign(destination.url)
}

/** Los días que se pueden reservar en esa unidad: con algún bloque libre, o con el día completo libre. */
const bookableDays = (days: AvailabilityDay[], unit: BookingUnit) =>
  days.filter((day) => (unit === 'DAY' ? day.fullDay?.available === true : day.slots.length > 0))

/**
 * Reservar un espacio (RE-02): se elige por hora o por día según los precios del espacio, el día y los bloques
 * (seguidos, mínimo una hora), se ve el desglose y se reserva. Las horas se muestran en la hora de Chile y se
 * mandan en UTC, tal como las entrega la disponibilidad. Sin sesión, reservar lleva al login.
 */
export function BookingWidget({ spaceId, pricePerHour, pricePerDay }: BookingWidgetProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const token = useToken()
  const [from] = useState(() => todayInSantiago())
  const to = addDays(from, BOOKING_WINDOW_DAYS - 1)
  const availability = useRequest(`${spaceId}:${from}`, (signal) => getAvailability(spaceId, from, to, signal))

  const units = (['HOUR', 'DAY'] as const).filter((unit) => (unit === 'HOUR' ? pricePerHour : pricePerDay) !== null)
  const [unit, setUnit] = useState<BookingUnit>(units[0] ?? 'HOUR')
  const [date, setDate] = useState('')
  const [range, setRange] = useState<SlotRange | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  if (units.length === 0) {
    return <p className="text-[15px] text-muted">Este espacio todavía no tiene precio para reservar.</p>
  }

  const price = (unit === 'HOUR' ? pricePerHour : pricePerDay) ?? 0
  const days = bookableDays(availability.data?.days ?? [], unit)
  const day = days.find((item) => item.date === date) ?? days[0]
  // Si la disponibilidad se recargó, la selección anterior puede no calzar con los bloques nuevos.
  const validRange = day && range && range.to < day.slots.length ? range : null
  const selection =
    unit === 'DAY'
      ? day?.fullDay
        ? { startAt: day.fullDay.startAt, endAt: day.fullDay.endAt }
        : null
      : day && validRange
        ? { startAt: day.slots[validRange.from].startAt, endAt: day.slots[validRange.to].endAt }
        : null
  const hours = selection ? hoursBetween(selection.startAt, selection.endAt) : 0
  const amounts = selection ? estimateAmounts(price, unit, hours) : null

  const toLogin = () => navigate(paths.login, { state: { from: location.pathname + location.search } })

  const changeUnit = (next: BookingUnit) => {
    setUnit(next)
    setDate('')
    setRange(null)
    setSubmitError(null)
  }

  const changeDate = (next: string) => {
    setDate(next)
    setRange(null)
    setSubmitError(null)
  }

  async function reserve() {
    if (!selection) return
    if (!token) {
      toLogin()
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const { bookingId, checkoutUrl } = await createBooking({ spaceId, startAt: selection.startAt, endAt: selection.endAt, unit })
      goToCheckout(checkoutUrl, bookingId, navigate)
    } catch (error) {
      setSubmitting(false)
      // La sesión venció: el cliente HTTP ya borró el token.
      if (error instanceof ApiError && error.status === 401) {
        toLogin()
        return
      }
      setSubmitError(error instanceof Error ? error.message : 'No pudimos reservar. Intenta de nuevo.')
      // Otro arrendatario tomó el horario: se recarga la disponibilidad para no ofrecerlo de nuevo.
      if (error instanceof ApiError && error.status === 409) {
        setRange(null)
        availability.retry()
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {units.length > 1 && (
        <fieldset>
          <legend className="mb-1.5 text-[15px] font-semibold">¿Cómo quieres arrendar?</legend>
          <div className="grid grid-cols-2 gap-2">
            {units.map((item) => (
              <label
                key={item}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-3 text-[15px] font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary',
                  unit === item ? 'border-primary bg-primary-soft text-primary-dark' : 'border-line bg-white text-ink',
                )}
              >
                <input
                  type="radio"
                  name={`booking-unit-${spaceId}`}
                  value={item}
                  checked={unit === item}
                  onChange={() => changeUnit(item)}
                  className="sr-only"
                />
                {UNIT_LABELS[item]}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {availability.loading && (
        <div role="status" aria-label="Cargando la disponibilidad" className="flex flex-col gap-2">
          <div className="h-12 motion-safe:animate-pulse rounded-control bg-line/60" />
          <div className="h-24 motion-safe:animate-pulse rounded-control bg-line/60" />
        </div>
      )}

      {availability.error && (
        <div className="flex flex-col items-start gap-2 text-[15px]">
          {availability.error instanceof ApiError && availability.error.status === 404 ? (
            <p className="text-muted">Este espacio no tiene horarios disponibles para reservar.</p>
          ) : (
            <>
              <p role="alert" className="font-semibold text-accent-ink">
                No pudimos cargar la disponibilidad. {availability.error.message}
              </p>
              <Button variant="secondary" size="sm" onClick={availability.retry}>
                Reintentar
              </Button>
            </>
          )}
        </div>
      )}

      {availability.data && days.length === 0 && (
        <p className="text-[15px] text-muted">
          No hay {unit === 'DAY' ? 'días completos' : 'horarios'} libres en los próximos {BOOKING_WINDOW_DAYS} días.
        </p>
      )}

      {day && (
        <>
          <Select
            label="Día"
            value={day.date}
            onChange={(event) => changeDate(event.target.value)}
            options={days.map((item) => ({ value: item.date, label: formatDayLabel(item.date) }))}
          />

          {unit === 'HOUR' ? (
            <fieldset>
              <legend className="mb-1 text-[15px] font-semibold">Horas</legend>
              <p className="mb-2 text-[13px] text-muted">
                Toca la hora de inicio y luego la última hora que necesitas. Deben ir seguidas.
              </p>
              <div className="grid grid-cols-3 gap-2 min-[400px]:grid-cols-4">
                {day.slots.map((slot, index) => {
                  const selected = validRange !== null && index >= validRange.from && index <= validRange.to
                  return (
                    <button
                      key={slot.startAt}
                      type="button"
                      aria-pressed={selected}
                      aria-label={`${formatTime(slot.startAt)} a ${formatTime(slot.endAt)}`}
                      onClick={() => {
                        setRange(toggleSlot(day.slots, validRange, index))
                        setSubmitError(null)
                      }}
                      className={cn(
                        'min-h-11 rounded-xl border text-[15px] font-semibold transition-colors',
                        selected ? 'border-primary bg-primary text-white' : 'border-line bg-white text-ink hover:bg-surface',
                      )}
                    >
                      {formatTime(slot.startAt)}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          ) : (
            day.fullDay && (
              <p className="text-[15px]">
                Día completo: <span className="font-semibold">{formatRange(day.fullDay.startAt, day.fullDay.endAt)}</span>
              </p>
            )
          )}
        </>
      )}

      {selection && amounts && (
        <section aria-label="Desglose del precio" className="rounded-xl bg-surface p-3.5 text-[15px]">
          <p className="mb-2 font-semibold">{formatRange(selection.startAt, selection.endAt)}</p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
            <dt className="text-muted">
              {unit === 'DAY' ? 'Precio por día' : `${formatClp(price)} × ${hours} ${hours === 1 ? 'hora' : 'horas'}`}
            </dt>
            <dd className="text-right">{formatClp(amounts.subtotal)}</dd>
            <dt className="text-muted">Comisión de servicio ({FEE_PERCENT} %)</dt>
            <dd className="text-right">{formatClp(amounts.fee)}</dd>
            <dt className="border-t border-line pt-1 font-bold">Total</dt>
            <dd className="border-t border-line pt-1 text-right font-bold">{formatClp(amounts.total)}</dd>
          </dl>
        </section>
      )}

      {submitError && (
        <p role="alert" className="rounded-xl border border-accent bg-accent-soft p-3 text-[15px] font-semibold text-accent-ink">
          {submitError}
        </p>
      )}

      <Button onClick={reserve} disabled={!selection} loading={submitting} className="w-full">
        Reservar
      </Button>
      {!token && <p className="-mt-2 text-center text-[13px] text-muted">Te pediremos iniciar sesión para reservar.</p>}
    </div>
  )
}
