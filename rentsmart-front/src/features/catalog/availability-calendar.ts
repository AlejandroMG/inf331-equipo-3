import { formatTime, TIME_ZONE } from '../bookings/booking-selection'
import type { AvailabilityDay } from '../bookings/types'
import type { ScheduleRule } from './types'

/** `free` se puede reservar; `busy` tiene una reserva; `past` ya empezó o pasó. */
export type CellState = 'free' | 'busy' | 'past'

/** Un bloque de una hora dentro del horario del día. */
export interface HourCell {
  /** La hora de inicio en Chile, de 0 a 23. */
  hour: number
  state: CellState
  /** El instante UTC que se manda para reservar; null si el bloque no está libre. */
  startAt: string | null
  endAt: string | null
}

export interface FullDayCell {
  state: Exclude<CellState, 'past'>
  startAt: string
  endAt: string
}

export interface CalendarDay {
  /** `AAAA-MM-DD`, en la hora de Chile. */
  date: string
  /** El día no tiene horario: no se arrienda. */
  closed: boolean
  cells: HourCell[]
  /** Para los espacios que solo se arriendan por día; null si ese día no tiene horario. */
  fullDay: FullDayCell | null
}

const hourOf = (time: string) => Number(time.slice(0, 2))

/** El día de la semana de un día del calendario, `AAAA-MM-DD` (0 = domingo), sin depender de la zona del navegador. */
function weekdayOf(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** "09:00" para la hora 9. */
export const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`

/** Las horas de inicio de los bloques del horario de un día de la semana, en orden. */
export function scheduledHours(rules: ScheduleRule[], weekday: number): number[] {
  const hours = new Set<number>()
  for (const rule of rules) {
    if (rule.weekday !== weekday) continue
    for (let hour = hourOf(rule.startTime); hour < hourOf(rule.endTime); hour += 1) hours.add(hour)
  }
  return [...hours].sort((a, b) => a - b)
}

/**
 * Une el horario semanal con los bloques libres que entrega la disponibilidad. La disponibilidad solo trae lo libre:
 * un bloque del horario que no aparece está ocupado, o ya pasó si es de hoy y su hora ya empezó. Así se puede dibujar
 * la semana con lo libre y lo ocupado sin que el back tenga que entregar las reservas de otras personas.
 */
export function buildCalendarDays(rules: ScheduleRule[], days: AvailabilityDay[], now: Date = new Date()): CalendarDay[] {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(now)
  const currentHour = hourOf(formatTime(now.toISOString()))

  return days.map((day) => {
    const hours = scheduledHours(rules, weekdayOf(day.date))
    const freeByHour = new Map(day.slots.map((slot) => [hourOf(formatTime(slot.startAt)), slot]))
    const cells = hours.map<HourCell>((hour) => {
      const slot = freeByHour.get(hour)
      if (slot) return { hour, state: 'free', startAt: slot.startAt, endAt: slot.endAt }
      const past = day.date < today || (day.date === today && hour <= currentHour)
      return { hour, state: past ? 'past' : 'busy', startAt: null, endAt: null }
    })
    return {
      date: day.date,
      closed: hours.length === 0,
      cells,
      fullDay: day.fullDay
        ? { state: day.fullDay.available ? 'free' : 'busy', startAt: day.fullDay.startAt, endAt: day.fullDay.endAt }
        : null,
    }
  })
}
