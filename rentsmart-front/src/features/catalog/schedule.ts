import type { ScheduleRule } from './types'

const DAY_NAMES: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  0: 'Domingo',
}

// La semana se muestra de lunes a domingo; en los datos 0 es domingo.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

export interface ScheduleRow {
  /** Por ejemplo "Lunes a viernes". */
  days: string
  /** Por ejemplo "09:00 – 21:00", o null si ese día no se arrienda. */
  hours: string | null
}

function dayLabel(first: number, last: number, count: number): string {
  const start = DAY_NAMES[first]
  if (count === 1) return start
  const end = DAY_NAMES[last].toLowerCase()
  return count === 2 ? `${start} y ${end}` : `${start} a ${end}`
}

/**
 * Agrupa los días consecutivos con el mismo horario para mostrarlo en pocas líneas:
 * de lunes a viernes 09:00–21:00 → "Lunes a viernes". Los días sin reglas quedan como "no disponible" (hours null).
 */
export function groupSchedule(rules: ScheduleRule[]): ScheduleRow[] {
  const hoursByDay = WEEK_ORDER.map((weekday) => {
    const ranges = rules
      .filter((rule) => rule.weekday === weekday)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((rule) => `${rule.startTime} – ${rule.endTime}`)
    return ranges.length > 0 ? ranges.join(', ') : null
  })

  const rows: ScheduleRow[] = []
  let start = 0
  for (let i = 1; i <= WEEK_ORDER.length; i++) {
    if (i < WEEK_ORDER.length && hoursByDay[i] === hoursByDay[start]) continue
    rows.push({ days: dayLabel(WEEK_ORDER[start], WEEK_ORDER[i - 1], i - start), hours: hoursByDay[start] })
    start = i
  }
  return rows
}
