import type { ScheduleRule } from '../catalog/types'

/** Un rango de un día: horas cerradas "HH:00" en hora de Chile; el fin llega hasta "24:00". */
export interface TimeRange {
  startTime: string
  endTime: string
}

/** Los rangos de cada día de la semana (0 = domingo ... 6 = sábado). Un día sin rangos no se arrienda. */
export type WeekForm = Record<number, TimeRange[]>

/** La semana se muestra de lunes a domingo; en los datos 0 es domingo. */
export const WEEK_DAYS = [
  { weekday: 1, name: 'Lunes' },
  { weekday: 2, name: 'Martes' },
  { weekday: 3, name: 'Miércoles' },
  { weekday: 4, name: 'Jueves' },
  { weekday: 5, name: 'Viernes' },
  { weekday: 6, name: 'Sábado' },
  { weekday: 0, name: 'Domingo' },
] as const

const hour = (n: number) => `${String(n).padStart(2, '0')}:00`
/** Inicios posibles: de 00:00 a 23:00. */
export const START_TIMES = Array.from({ length: 24 }, (_, i) => hour(i))
/** Fines posibles: de 01:00 a 24:00. */
export const END_TIMES = Array.from({ length: 24 }, (_, i) => hour(i + 1))

/** El rango con que parte un día recién activado. */
export const DEFAULT_RANGE: TimeRange = { startTime: '09:00', endTime: '18:00' }

export const emptyWeek = (): WeekForm => Object.fromEntries(WEEK_DAYS.map((day) => [day.weekday, []]))

/** Las reglas de la API repartidas por día, cada día por hora de inicio. */
export function toWeek(rules: ScheduleRule[]): WeekForm {
  const week = emptyWeek()
  for (const { weekday, startTime, endTime } of rules) week[weekday]?.push({ startTime, endTime })
  for (const ranges of Object.values(week)) ranges.sort((a, b) => a.startTime.localeCompare(b.startTime))
  return week
}

/** Lo que se manda a la API: una regla por rango, de lunes a domingo. */
export function toRules(week: WeekForm): ScheduleRule[] {
  return WEEK_DAYS.flatMap(({ weekday }) => week[weekday].map((range) => ({ weekday, ...range })))
}

/**
 * Por qué los rangos de un día no valen, o null si valen. Las mismas reglas que el back: el fin es posterior
 * al inicio y los rangos no se traslapan (dos contiguos, 09:00 a 13:00 y 13:00 a 18:00, sí valen).
 */
export function dayError(ranges: TimeRange[]): string | null {
  if (ranges.some((range) => range.endTime <= range.startTime)) return 'El fin debe ser posterior al inicio.'
  const sorted = [...ranges].sort((a, b) => a.startTime.localeCompare(b.startTime))
  const overlap = sorted.some((range, i) => i > 0 && sorted[i - 1].endTime > range.startTime)
  return overlap ? 'Los rangos no pueden traslaparse.' : null
}

/**
 * El rango que se agrega a un día que ya tiene alguno: la hora siguiente al último fin. Null si el día ya
 * llega a las 24:00 y no queda dónde agregar.
 */
export function nextRange(ranges: TimeRange[]): TimeRange | null {
  const lastEnd = ranges.reduce((max, range) => (range.endTime > max ? range.endTime : max), '00:00')
  const start = Number(lastEnd.slice(0, 2))
  return start >= 24 ? null : { startTime: hour(start), endTime: hour(start + 1) }
}
