import { BookingStatus, BookingUnit } from '../generated/prisma/enums';
import { santiagoStartOfDay, santiagoWallClock, weekdayOf } from '../common/santiago-time';
import { MAX_AVAILABILITY_DAYS } from './dto/availability-query.dto';
import { AvailabilityDayDto } from './dto/availability.dto';
import { WeeklyRule } from './schedule-rules';

// Lógica de la disponibilidad (DI-02) sin Nest ni Prisma: el horario semanal en hora de Chile se pasa a bloques UTC
// de una hora y se descuentan los ocupados y los que ya pasaron. Todos los rangos son semiabiertos, [inicio, fin):
// una reserva que termina a las 12:00 no choca con otra que empieza a las 12:00.

export const HOUR_MS = 3_600_000;

/** Una fecha del calendario de Chile. `day` puede salirse del mes: el 32 de octubre es el 1 de noviembre. */
export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

/** Un intervalo ocupado, en UTC. */
export interface BusyInterval {
  startAt: Date;
  endAt: Date;
}

/** Lo que hace falta de una reserva para saber si ocupa el horario. */
export interface BookingHold extends BusyInterval {
  status: BookingStatus;
  expiresAt: Date | null;
}

/** Los estados que pueden ocupar el horario; una `PENDING` además tiene que estar vigente (P-06). */
export const HOLDING_STATUSES: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.PAID, BookingStatus.CONFIRMED];

/**
 * Si la reserva ocupa el horario en `now`: `PAID`, `CONFIRMED` o una `PENDING` cuyo plazo de pago no ha vencido.
 * Una `PENDING` sin `expiresAt` cuenta como vigente, igual que en la restricción `booking_no_overlap` y en RE-05.
 */
export function isHolding(booking: Pick<BookingHold, 'status' | 'expiresAt'>, now: Date): boolean {
  if (booking.status === BookingStatus.PENDING) return !booking.expiresAt || booking.expiresAt > now;
  return booking.status === BookingStatus.PAID || booking.status === BookingStatus.CONFIRMED;
}

/** `AAAA-MM-DD` como fecha, o null si ese día no existe (`2026-02-30`). El formato ya lo validó el DTO. */
export function parseDate(text: string): CalendarDate | null {
  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

/** Cuántos días hay de `from` a `to`, contando los dos: 1 si son el mismo, 0 o menos si `from` es posterior. */
export function daysBetween(from: CalendarDate, to: CalendarDate): number {
  const utc = ({ year, month, day }: CalendarDate) => Date.UTC(year, month - 1, day);
  return Math.round((utc(to) - utc(from)) / (24 * HOUR_MS)) + 1;
}

/** La fecha `AAAA-MM-DD`, ya normalizada (un día fuera del mes pasa al mes que corresponde). */
export function formatDate({ year, month, day }: CalendarDate): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

const hourOf = (time: string) => Number(time.slice(0, 2));

/**
 * Los inicios UTC (ms) de las horas de ese día de Chile que están en el horario, en orden. Se recorren las horas
 * reales del día y cada una se compara con la hora que marca el reloj: así el día de 23 horas de septiembre no
 * tiene las 00:00 y el de 25 horas de abril tiene dos veces las 23:00. Un rango hasta las `24:00` termina en el
 * inicio del día siguiente, y dos rangos contiguos quedan como horas seguidas.
 */
export function scheduleHours(rules: WeeklyRule[], date: CalendarDate): number[] {
  const weekday = weekdayOf(date.year, date.month, date.day);
  const ranges = rules
    .filter((rule) => rule.weekday === weekday)
    .map((rule) => [hourOf(rule.startTime), hourOf(rule.endTime)] as const);
  if (ranges.length === 0) return [];

  const start = santiagoStartOfDay(date.year, date.month, date.day).getTime();
  const end = santiagoStartOfDay(date.year, date.month, date.day + 1).getTime();
  const hours: number[] = [];
  for (let utc = start; utc < end; utc += HOUR_MS) {
    const { hour } = santiagoWallClock(utc);
    if (ranges.some(([from, to]) => from <= hour && hour < to)) hours.push(utc);
  }
  return hours;
}

/** Si [startMs, endMs) se cruza con algún intervalo ocupado. */
function overlapsBusy(startMs: number, endMs: number, busy: BusyInterval[]): boolean {
  return busy.some((interval) => interval.startAt.getTime() < endMs && startMs < interval.endAt.getTime());
}

const isBusy = (startMs: number, busy: BusyInterval[]) => overlapsBusy(startMs, startMs + HOUR_MS, busy);

/** Un bloque ya pasó si empezó: a las 10:30 ya no se reserva de 10:00 a 11:00. */
const hasStarted = (startMs: number, now: Date) => startMs <= now.getTime();

/**
 * La disponibilidad de un día de Chile: los bloques libres y el día completo. `fullDay` va del primer inicio al
 * último fin del horario (aunque haya una pausa al medio) y no está disponible si alguna hora del horario está
 * ocupada o ya pasó, ni si una reserva cae en la pausa (puede quedar una si el horario cambió después de reservar,
 * y `booking_no_overlap` rechazaría el día completo). Es null si ese día no se arrienda.
 */
export function availabilityOfDay(
  rules: WeeklyRule[],
  date: CalendarDate,
  busy: BusyInterval[],
  now: Date,
): AvailabilityDayDto {
  const hours = scheduleHours(rules, date);
  const free = hours.filter((start) => !hasStarted(start, now) && !isBusy(start, busy));
  const first = hours[0];
  const last = hours[hours.length - 1] + HOUR_MS;
  return {
    date: formatDate(date),
    slots: free.map((start) => ({ startAt: new Date(start), endAt: new Date(start + HOUR_MS) })),
    fullDay:
      hours.length === 0
        ? null
        : {
            startAt: new Date(first),
            endAt: new Date(last),
            available: free.length === hours.length && !overlapsBusy(first, last, busy),
          },
  };
}

/** Los días de Chile que toca el rango [startAt, endAt), del primero al último. */
export function datesOfRange(startAt: Date, endAt: Date): CalendarDate[] {
  const first = santiagoWallClock(startAt);
  const last = santiagoWallClock(endAt.getTime() - 1);
  const count = daysBetween(first, last);
  return Array.from({ length: count }, (_, i) => ({ year: first.year, month: first.month, day: first.day + i }));
}

/** El rango más largo que revisa `isRangeAvailable`, el mismo tope de días de la consulta de disponibilidad. */
export const MAX_RANGE_MS = MAX_AVAILABILITY_DAYS * 24 * HOUR_MS;

/** Cómo se revisa un rango. Por defecto, por hora y sin aceptar uno que ya empezó. */
export interface RangeCheck {
  /** `HOUR` (por defecto): cada hora en el horario. `DAY`: el rango es exactamente el `fullDay` de un día de Chile. */
  unit?: BookingUnit;
  /** Acepta un rango que ya empezó, mientras no haya terminado. Para RE-04: se paga a las 10:02 el bloque de 10:00. */
  allowStarted?: boolean;
}

/**
 * Si vale la pena revisar [startAt, endAt): fechas válidas en horas cerradas, fin posterior al inicio, a lo más
 * 31 días (para no recorrer años de horario) y sin empezar todavía (o, con `allowStarted`, sin terminar). No mira el
 * horario ni las reservas.
 */
export function isBookableRange(startAt: Date, endAt: Date, now: Date, allowStarted = false): boolean {
  const start = startAt.getTime();
  const end = endAt.getTime();
  if (!(start < end) || end - start > MAX_RANGE_MS) return false;
  if (start % HOUR_MS !== 0 || end % HOUR_MS !== 0) return false;
  return allowStarted ? end > now.getTime() : !hasStarted(start, now);
}

/**
 * Si se puede reservar [startAt, endAt) en una de dos formas. El estado del espacio lo revisa quien llama.
 * - Por hora: cada hora dentro del horario (puede cruzar la medianoche si el horario sigue al otro día) y ninguna
 *   ocupada. No cruza una pausa.
 * - Por día: el rango es exactamente el `fullDay` de ese día de Chile, y no lo toca ninguna reserva, tampoco en la
 *   pausa. Es la misma regla que `fullDay.available`, así que el endpoint y esta función no se contradicen.
 */
export function isRangeAvailable(
  rules: WeeklyRule[],
  startAt: Date,
  endAt: Date,
  busy: BusyInterval[],
  now: Date,
  { unit = BookingUnit.HOUR, allowStarted = false }: RangeCheck = {},
): boolean {
  if (!isBookableRange(startAt, endAt, now, allowStarted)) return false;
  const start = startAt.getTime();
  const end = endAt.getTime();

  if (unit === BookingUnit.DAY) {
    const hours = scheduleHours(rules, santiagoWallClock(startAt));
    if (hours.length === 0 || hours[0] !== start || hours[hours.length - 1] + HOUR_MS !== end) return false;
    return !overlapsBusy(start, end, busy);
  }

  const inSchedule = new Set(datesOfRange(startAt, endAt).flatMap((date) => scheduleHours(rules, date)));
  for (let hour = start; hour < end; hour += HOUR_MS) {
    if (!inSchedule.has(hour) || isBusy(hour, busy)) return false;
  }
  return true;
}
