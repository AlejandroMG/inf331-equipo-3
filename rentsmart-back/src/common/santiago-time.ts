/**
 * Fechas en la hora de Chile. Las fechas viven en UTC en la BD y se muestran en `America/Santiago` (el horario de
 * verano cambia el desfase entre UTC-4 y UTC-3), así que "el mes de octubre" o "el 3 de octubre" empiezan en
 * momentos UTC distintos según la fecha.
 */
const TIME_ZONE = 'America/Santiago';

/** Cuántos minutos va la hora de Chile respecto de UTC en ese instante (-180 en verano, -240 en invierno). */
function offsetMinutes(utcMs: number): number {
  const name =
    new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE,
      timeZoneName: 'longOffset',
    })
      .formatToParts(new Date(utcMs))
      .find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -minutes : minutes;
}

/** El instante (UTC) en que empieza el día `day` del mes `month` (1 a 12) en Chile. Acepta `day` fuera del mes. */
export function santiagoStartOfDay(
  year: number,
  month: number,
  day: number,
): Date {
  const local = Date.UTC(year, month - 1, day);
  // El desfase depende del instante que se busca: se corrige una vez con el primer cálculo.
  const first = local - offsetMinutes(local) * 60_000;
  return new Date(local - offsetMinutes(first) * 60_000);
}

/** El día de la semana (0 = domingo ... 6 = sábado) de una fecha del calendario. No depende de la zona. */
export function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** El año y el mes (1 a 12) en que está `now` en Chile. */
export function santiagoMonthOf(now: Date = new Date()): {
  year: number;
  month: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: get('year'), month: get('month') };
}

/** Desde el primer instante del mes (incluido) hasta el primero del mes siguiente (excluido), en Chile. */
export function santiagoMonthRange(
  year: number,
  month: number,
): { start: Date; end: Date } {
  return {
    start: santiagoStartOfDay(year, month, 1),
    end: santiagoStartOfDay(year, month + 1, 1),
  };
}

/** Las horas entre dos horas "HH:mm" del mismo día: `("09:00", "21:00")` son 12. */
export function hoursBetween(startTime: string, endTime: string): number {
  const minutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };
  return Math.max(0, (minutes(endTime) - minutes(startTime)) / 60);
}
