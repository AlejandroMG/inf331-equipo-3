import { santiagoStartOfDay, santiagoWallClock, weekdayOf } from '../../src/common/santiago-time';

const HOUR = 3_600_000;

/**
 * Fechas para los e2e de reservas, calculadas desde hoy para que nunca queden en el pasado (una fecha fija, como
 * 2030, termina pasando y además no es la de un uso real).
 *
 * Devuelve `at(dayOffset, hour)`: el instante UTC, en ISO 8601, de la hora `hour` (0 a 24) del día que está
 * `dayOffset` días después del lunes de dentro de `weeksAhead` semanas, en la hora de Chile. Con el valor por
 * defecto, `at(0, 10)` es el lunes a 4 semanas (o 4 semanas y unos días) a las 10:00 de Chile; `at(1, 9)`, el martes
 * siguiente a las 09:00; `at(-1, 10)`, el domingo anterior. Con `weeksAhead` negativo da fechas que ya pasaron.
 *
 * Chile solo cambia la hora en la medianoche de un sábado a domingo, así que de lunes a viernes sumar horas al inicio
 * del día da la hora que marca el reloj. El domingo del cambio de septiembre empieza a la 01:00: ahí, usar horas de
 * 01:00 en adelante.
 */
export function bookingWeek(weeksAhead = 4, now: Date = new Date()) {
  const today = santiagoWallClock(now);
  const weekday = weekdayOf(today.year, today.month, today.day);
  // Días hasta el próximo lunes (0 si hoy es lunes), más las semanas pedidas.
  const monday = today.day + ((8 - weekday) % 7) + weeksAhead * 7;
  return (dayOffset: number, hour: number): string =>
    new Date(santiagoStartOfDay(today.year, today.month, monday + dayOffset).getTime() + hour * HOUR).toISOString();
}
