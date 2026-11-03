/**
 * Fechas en la hora de Chile. Las fechas viven en UTC en la BD y se muestran en `America/Santiago` (el horario de
 * verano cambia el desfase entre UTC-4 y UTC-3), así que "el mes de octubre" o "el 3 de octubre" empiezan en
 * momentos UTC distintos según la fecha.
 */
export const TIME_ZONE = 'America/Santiago';
const DAY_MS = 24 * 3_600_000;

// Se crea una vez: la disponibilidad lo consulta por cada hora de hasta 31 días.
const OFFSET_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  timeZoneName: 'longOffset',
});

/** Cuántos minutos va la hora de Chile respecto de UTC en ese instante (-180 en verano, -240 en invierno). */
function offsetMinutes(utcMs: number): number {
  const name =
    OFFSET_FORMAT.formatToParts(new Date(utcMs)).find(
      (part) => part.type === 'timeZoneName',
    )?.value ?? 'GMT';
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -minutes : minutes;
}

/**
 * El instante (UTC) en que empieza el día `day` del mes `month` (1 a 12) en Chile. Acepta `day` fuera del mes.
 *
 * Chile cambia la hora justo a la medianoche de un sábado a domingo. En septiembre la medianoche del domingo no
 * existe (de las 23:59 del sábado se pasa a las 01:00): ese domingo empieza a la 01:00 y dura 23 horas. En abril
 * las 23:00 del sábado se repiten: ese sábado dura 25 horas.
 */
export function santiagoStartOfDay(
  year: number,
  month: number,
  day: number,
): Date {
  const local = Date.UTC(year, month - 1, day);
  // Los dos desfases posibles son el de un día antes y el de un día después. El día empieza en el primer
  // instante cuya hora de Chile ya es esa medianoche o posterior: el más temprano de los candidatos que lo cumpla.
  const candidates = [
    local - offsetMinutes(local - DAY_MS) * 60_000,
    local - offsetMinutes(local + DAY_MS) * 60_000,
  ].sort((a, b) => a - b);
  const start =
    candidates.find((utc) => utc + offsetMinutes(utc) * 60_000 >= local) ??
    candidates[1];
  return new Date(start);
}

/** La fecha y la hora (0 a 23) que marca el reloj en Chile en ese instante. */
export function santiagoWallClock(instant: Date | number): {
  year: number;
  month: number;
  day: number;
  hour: number;
} {
  const utc = typeof instant === 'number' ? instant : instant.getTime();
  const wall = new Date(utc + offsetMinutes(utc) * 60_000);
  return {
    year: wall.getUTCFullYear(),
    month: wall.getUTCMonth() + 1,
    day: wall.getUTCDate(),
    hour: wall.getUTCHours(),
  };
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
