import { useState } from 'react'
import { Button } from '../../components/Button'
import { cn } from '../../lib/cn'
import { ApiError } from '../../lib/http'
import { useRequest } from '../../lib/useRequest'
import { addDays, BOOKING_WINDOW_DAYS, formatDayLabel, todayInSantiago } from '../bookings/booking-selection'
import { getAvailability } from '../bookings/bookings-api'
import type { BookingUnit } from '../bookings/types'
import { buildCalendarDays, hourLabel, type CalendarDay, type CellState } from './availability-calendar'
import type { ScheduleRule } from './types'

const DAYS_PER_WEEK = 7
const WEEKS = Math.ceil(BOOKING_WINDOW_DAYS / DAYS_PER_WEEK)

/** Lo que elige quien toca un bloque libre: el widget de reserva lo recibe ya cargado. */
export interface CalendarPick {
  unit: BookingUnit
  /** `AAAA-MM-DD`, hora de Chile. */
  date: string
  /** El inicio del bloque en UTC; null al elegir un día completo. */
  startAt: string | null
}

export interface AvailabilityCalendarProps {
  spaceId: string
  schedule: ScheduleRule[]
  pricePerHour: number | null
  pricePerDay: number | null
  onPick: (pick: CalendarPick) => void
}

const monthDay = new Intl.DateTimeFormat('es-CL', { timeZone: 'UTC', day: 'numeric', month: 'short' })
const shortDay = new Intl.DateTimeFormat('es-CL', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })

/** Un día del calendario, `AAAA-MM-DD`, como fecha UTC a medianoche para darle formato sin mover el día. */
function asDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

const STATE_TEXT: Record<CellState, string> = { free: 'libre', busy: 'ocupado', past: 'ya pasó' }

const CELL_CLASS: Record<CellState, string> = {
  free: 'border-primary bg-primary-soft text-primary-dark hover:bg-primary hover:text-white',
  busy: 'border-line bg-surface text-muted line-through',
  past: 'border-transparent bg-transparent text-muted/60',
}

function DayRow({
  day,
  hourly,
  onPick,
}: {
  day: CalendarDay
  hourly: boolean
  onPick: AvailabilityCalendarProps['onPick']
}) {
  const text = shortDay.format(asDate(day.date))
  const label = text.charAt(0).toUpperCase() + text.slice(1)
  return (
    <li className="flex flex-col gap-2 border-b border-line py-3 last:border-b-0 sm:flex-row sm:items-start sm:gap-4">
      <h3 className="shrink-0 text-[15px] font-semibold sm:w-28 sm:pt-2.5">{label}</h3>
      {day.closed || (!hourly && !day.fullDay) ? (
        <p className="text-[15px] text-muted sm:pt-2.5">No se arrienda este día.</p>
      ) : hourly ? (
        <ul className="grid flex-1 grid-cols-4 gap-2 min-[480px]:grid-cols-6">
          {day.cells.map((cell) => {
            const start = hourLabel(cell.hour)
            const name = `${label}, ${start} a ${hourLabel(cell.hour + 1)}: ${STATE_TEXT[cell.state]}`
            return (
              <li key={cell.hour}>
                <button
                  type="button"
                  disabled={cell.state !== 'free'}
                  aria-label={name}
                  onClick={() => onPick({ unit: 'HOUR', date: day.date, startAt: cell.startAt })}
                  className={cn(
                    'min-h-11 w-full rounded-xl border text-[15px] font-semibold transition-colors disabled:cursor-not-allowed',
                    CELL_CLASS[cell.state],
                  )}
                >
                  {start}
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        day.fullDay && (
          <button
            type="button"
            disabled={day.fullDay.state !== 'free'}
            aria-label={`${label}, día completo: ${STATE_TEXT[day.fullDay.state]}`}
            onClick={() => onPick({ unit: 'DAY', date: day.date, startAt: null })}
            className={cn(
              'min-h-11 rounded-xl border px-4 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed',
              CELL_CLASS[day.fullDay.state],
            )}
          >
            Día completo
          </button>
        )
      )}
    </li>
  )
}

/**
 * Calendario de disponibilidad del detalle (BU-06): dos semanas desde hoy con los bloques libres y los ocupados del
 * horario del espacio. Tocar un bloque libre se lo pasa a `onPick` para dejar la reserva cargada. Por hora si el espacio
 * tiene precio por hora; si solo se arrienda por día, un botón por día.
 */
export function AvailabilityCalendar({ spaceId, schedule, pricePerHour, pricePerDay, onPick }: AvailabilityCalendarProps) {
  const [from] = useState(() => todayInSantiago())
  const [now] = useState(() => new Date())
  const [week, setWeek] = useState(0)
  const to = addDays(from, BOOKING_WINDOW_DAYS - 1)
  const { data, error, loading, retry } = useRequest(`calendar:${spaceId}:${from}`, (signal) =>
    getAvailability(spaceId, from, to, signal),
  )

  const hourly = pricePerHour !== null
  if (!hourly && pricePerDay === null) return null
  // Sin disponibilidad publicada el widget de reserva ya lo explica: aquí no se repite.
  if (error instanceof ApiError && error.status === 404) return null

  const days = data ? buildCalendarDays(schedule, data.days.slice(week * DAYS_PER_WEEK, (week + 1) * DAYS_PER_WEEK), now) : []
  const first = days[0]
  const last = days[days.length - 1]

  return (
    <div className="flex flex-col gap-3">
      {loading && (
        <div role="status" aria-label="Cargando el calendario" className="flex flex-col gap-2">
          <div className="h-10 motion-safe:animate-pulse rounded-control bg-line/60" />
          <div className="h-40 motion-safe:animate-pulse rounded-control bg-line/60" />
        </div>
      )}

      {error && (
        <div className="flex flex-col items-start gap-2 text-[15px]">
          <p role="alert" className="font-semibold text-accent-ink">
            No pudimos cargar el calendario. {error.message}
          </p>
          <Button variant="secondary" size="sm" onClick={retry}>
            Reintentar
          </Button>
        </div>
      )}

      {first && last && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" size="sm" disabled={week === 0} onClick={() => setWeek(week - 1)}>
              Semana anterior
            </Button>
            <p aria-live="polite" className="text-[15px] font-semibold">
              {monthDay.format(asDate(first.date))} – {monthDay.format(asDate(last.date))}
            </p>
            <Button variant="secondary" size="sm" disabled={week >= WEEKS - 1} onClick={() => setWeek(week + 1)}>
              Semana siguiente
            </Button>
          </div>

          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted" aria-label="Leyenda">
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-3.5 rounded border border-primary bg-primary-soft" /> Libre
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-3.5 rounded border border-line bg-surface" /> Ocupado
            </li>
          </ul>

          <ul aria-label={`Disponibilidad del ${formatDayLabel(first.date)} al ${formatDayLabel(last.date)}`}>
            {days.map((day) => (
              <DayRow key={day.date} day={day} hourly={hourly} onPick={onPick} />
            ))}
          </ul>
          <p className="text-sm text-muted">Toca un bloque libre para cargarlo en la reserva.</p>
        </>
      )}
    </div>
  )
}
