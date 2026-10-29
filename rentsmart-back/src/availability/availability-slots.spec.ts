import { BookingStatus } from '../generated/prisma/enums';
import {
  availabilityOfDay,
  BusyInterval,
  datesOfRange,
  daysBetween,
  formatDate,
  isHolding,
  isRangeAvailable,
  parseDate,
  scheduleHours,
} from './availability-slots';
import { WeeklyRule } from './schedule-rules';

const rule = (weekday: number, startTime: string, endTime: string): WeeklyRule => ({ weekday, startTime, endTime });
const at = (iso: string) => new Date(iso);
const busy = (startAt: string, endAt: string): BusyInterval => ({ startAt: at(startAt), endAt: at(endAt) });
const iso = (ms: number) => new Date(ms).toISOString();
const starts = (day: { slots: Array<{ startAt: Date }> }) => day.slots.map((slot) => slot.startAt.toISOString());

// El lunes 12 de octubre de 2026 Chile está en UTC-3: las 09:00 son las 12:00 UTC.
const MONDAY = { year: 2026, month: 10, day: 12 };
const MONDAY_9_TO_21 = [rule(1, '09:00', '21:00')];
// Un reloj fijo antes de todo lo que se prueba, salvo que el test diga otra cosa.
const LONG_AGO = at('2026-01-01T00:00:00Z');

describe('availability-slots', () => {
  describe('fechas', () => {
    it('parseDate acepta un día que existe y rechaza uno que no', () => {
      expect(parseDate('2026-10-12')).toEqual(MONDAY);
      expect(parseDate('2028-02-29')).toEqual({ year: 2028, month: 2, day: 29 });
      expect(parseDate('2026-02-29')).toBeNull();
      expect(parseDate('2026-02-30')).toBeNull();
      expect(parseDate('2026-04-31')).toBeNull();
    });

    it('daysBetween cuenta los dos extremos y da 0 o menos si el rango está al revés', () => {
      expect(daysBetween(MONDAY, MONDAY)).toBe(1);
      expect(daysBetween({ year: 2026, month: 10, day: 1 }, { year: 2026, month: 10, day: 31 })).toBe(31);
      expect(daysBetween({ year: 2026, month: 10, day: 13 }, MONDAY)).toBe(0);
      // Cruza el cambio de hora de abril y el fin de año: cuenta días del calendario, no múltiplos de 24 horas.
      expect(daysBetween({ year: 2026, month: 4, day: 1 }, { year: 2026, month: 4, day: 10 })).toBe(10);
      expect(daysBetween({ year: 2026, month: 12, day: 31 }, { year: 2027, month: 1, day: 1 })).toBe(2);
    });

    it('formatDate normaliza un día fuera del mes', () => {
      expect(formatDate({ year: 2026, month: 10, day: 32 })).toBe('2026-11-01');
      expect(formatDate({ year: 2026, month: 12, day: 32 })).toBe('2027-01-01');
    });

    it('datesOfRange da los días de Chile, no los de UTC', () => {
      // De las 22:00 del lunes a las 02:00 del martes en Chile: en UTC todo es el martes 13.
      expect(datesOfRange(at('2026-10-13T01:00:00Z'), at('2026-10-13T05:00:00Z'))).toEqual([
        MONDAY,
        { year: 2026, month: 10, day: 13 },
      ]);
      // Un rango que termina justo a la medianoche no toca el día siguiente.
      expect(datesOfRange(at('2026-10-13T02:00:00Z'), at('2026-10-13T03:00:00Z'))).toEqual([MONDAY]);
    });
  });

  describe('isHolding', () => {
    const now = at('2026-10-12T15:00:00Z');
    const hold = (status: BookingStatus, expiresAt: string | null = null) => ({
      status,
      expiresAt: expiresAt ? at(expiresAt) : null,
    });

    it('ocupan una PENDING vigente, PAID y CONFIRMED', () => {
      expect(isHolding(hold(BookingStatus.PENDING, '2026-10-12T15:20:00Z'), now)).toBe(true);
      expect(isHolding(hold(BookingStatus.PAID), now)).toBe(true);
      expect(isHolding(hold(BookingStatus.CONFIRMED), now)).toBe(true);
    });

    it('una PENDING vencida ya no ocupa, aunque nadie la haya pasado a EXPIRED', () => {
      expect(isHolding(hold(BookingStatus.PENDING, '2026-10-12T14:59:59Z'), now)).toBe(false);
      // Vence justo ahora: ya no retiene.
      expect(isHolding(hold(BookingStatus.PENDING, '2026-10-12T15:00:00Z'), now)).toBe(false);
    });

    it('una PENDING sin expiresAt cuenta como vigente, igual que en booking_no_overlap', () => {
      expect(isHolding(hold(BookingStatus.PENDING), now)).toBe(true);
    });

    it.each([BookingStatus.CANCELLED, BookingStatus.EXPIRED, BookingStatus.FINISHED])('%s no ocupa', (status) => {
      expect(isHolding(hold(status), now)).toBe(false);
    });
  });

  describe('scheduleHours', () => {
    it('pasa el horario de Chile a UTC: en verano las 09:00 son las 12:00 UTC', () => {
      const hours = scheduleHours(MONDAY_9_TO_21, MONDAY);

      expect(hours).toHaveLength(12);
      expect(iso(hours[0])).toBe('2026-10-12T12:00:00.000Z');
      // La última hora, de 20:00 a 21:00 en Chile, ya es el martes en UTC.
      expect(iso(hours[11])).toBe('2026-10-12T23:00:00.000Z');
    });

    it('en invierno (UTC-4) las mismas 09:00 son las 13:00 UTC', () => {
      // El miércoles 1 de julio de 2026.
      const hours = scheduleHours([rule(3, '09:00', '21:00')], { year: 2026, month: 7, day: 1 });

      expect(iso(hours[0])).toBe('2026-07-01T13:00:00.000Z');
    });

    it('un día que no está en el horario no tiene horas', () => {
      expect(scheduleHours(MONDAY_9_TO_21, { year: 2026, month: 10, day: 13 })).toEqual([]);
    });

    it('dos rangos contiguos son horas seguidas', () => {
      const hours = scheduleHours([rule(1, '13:00', '18:00'), rule(1, '09:00', '13:00')], MONDAY);

      expect(hours).toEqual(scheduleHours([rule(1, '09:00', '18:00')], MONDAY));
    });

    it('un horario hasta las 24:00 termina en el inicio del día siguiente', () => {
      const hours = scheduleHours([rule(1, '20:00', '24:00')], MONDAY);

      expect(hours.map(iso)).toEqual([
        '2026-10-12T23:00:00.000Z',
        '2026-10-13T00:00:00.000Z',
        '2026-10-13T01:00:00.000Z',
        '2026-10-13T02:00:00.000Z',
      ]);
    });

    describe('cambios de hora', () => {
      // El sábado 5 de septiembre de 2026 a las 24:00 Chile adelanta la hora: del sábado a las 23:59 (UTC-4) pasa al
      // domingo a la 01:00 (UTC-3). La medianoche del domingo no existe y ese día dura 23 horas.
      const SEPT_SATURDAY = { year: 2026, month: 9, day: 5 };
      const SEPT_SUNDAY = { year: 2026, month: 9, day: 6 };

      it('el domingo de septiembre tiene 23 horas y empieza a la 01:00 de Chile', () => {
        const hours = scheduleHours([rule(0, '00:00', '24:00')], SEPT_SUNDAY);

        expect(hours).toHaveLength(23);
        expect(iso(hours[0])).toBe('2026-09-06T04:00:00.000Z');
        expect(iso(hours[22])).toBe('2026-09-07T02:00:00.000Z');
      });

      it('ese domingo no hay bloque de 00:00 a 01:00: esa hora no existe', () => {
        expect(scheduleHours([rule(0, '00:00', '01:00')], SEPT_SUNDAY)).toEqual([]);
        expect(scheduleHours([rule(0, '00:00', '02:00')], SEPT_SUNDAY).map(iso)).toEqual(['2026-09-06T04:00:00.000Z']);
      });

      it('el sábado anterior hasta las 24:00 termina justo en el cambio, sin hueco ni traslape', () => {
        const saturday = scheduleHours([rule(6, '22:00', '24:00')], SEPT_SATURDAY);
        const sunday = scheduleHours([rule(0, '00:00', '03:00')], SEPT_SUNDAY);

        expect([...saturday, ...sunday].map(iso)).toEqual([
          '2026-09-06T02:00:00.000Z',
          '2026-09-06T03:00:00.000Z',
          '2026-09-06T04:00:00.000Z',
          '2026-09-06T05:00:00.000Z',
        ]);
      });

      // El sábado 4 de abril de 2026 a las 24:00 Chile atrasa la hora: del sábado a las 23:59 (UTC-3) vuelve al
      // sábado a las 23:00 (UTC-4). Las 23:00 del sábado se repiten y ese día dura 25 horas.
      const APRIL_SATURDAY = { year: 2026, month: 4, day: 4 };
      const APRIL_SUNDAY = { year: 2026, month: 4, day: 5 };

      it('el sábado de abril tiene 25 horas: las 23:00 se repiten', () => {
        const hours = scheduleHours([rule(6, '00:00', '24:00')], APRIL_SATURDAY);

        expect(hours).toHaveLength(25);
        expect(iso(hours[0])).toBe('2026-04-04T03:00:00.000Z');
        expect(hours.slice(-2).map(iso)).toEqual(['2026-04-05T02:00:00.000Z', '2026-04-05T03:00:00.000Z']);
      });

      it('de 23:00 a 24:00 ese sábado son dos bloques, y el domingo empieza a las 04:00 UTC', () => {
        expect(scheduleHours([rule(6, '23:00', '24:00')], APRIL_SATURDAY)).toHaveLength(2);
        expect(iso(scheduleHours([rule(0, '00:00', '01:00')], APRIL_SUNDAY)[0])).toBe('2026-04-05T04:00:00.000Z');
      });
    });
  });

  describe('availabilityOfDay', () => {
    it('trae los bloques libres en UTC y el día completo', () => {
      const day = availabilityOfDay(MONDAY_9_TO_21, MONDAY, [], LONG_AGO);

      expect(day.date).toBe('2026-10-12');
      expect(day.slots).toHaveLength(12);
      expect(day.slots[0]).toEqual({ startAt: at('2026-10-12T12:00:00Z'), endAt: at('2026-10-12T13:00:00Z') });
      expect(day.fullDay).toEqual({
        startAt: at('2026-10-12T12:00:00Z'),
        endAt: at('2026-10-13T00:00:00Z'),
        available: true,
      });
    });

    it('un día que no se arrienda no tiene bloques y su fullDay es null', () => {
      expect(availabilityOfDay(MONDAY_9_TO_21, { year: 2026, month: 10, day: 11 }, [], LONG_AGO)).toEqual({
        date: '2026-10-11',
        slots: [],
        fullDay: null,
      });
    });

    it('reservas contiguas: de 10:00 a 12:00 ocupa dos bloques y deja libres las 09:00 y las 12:00', () => {
      const day = availabilityOfDay(MONDAY_9_TO_21, MONDAY, [busy('2026-10-12T13:00:00Z', '2026-10-12T15:00:00Z')], LONG_AGO);

      expect(starts(day)).toHaveLength(10);
      expect(starts(day).slice(0, 2)).toEqual(['2026-10-12T12:00:00.000Z', '2026-10-12T15:00:00.000Z']);
      expect(day.fullDay?.available).toBe(false);
    });

    it('dos reservas pegadas ocupan sus horas y nada más', () => {
      const day = availabilityOfDay(
        MONDAY_9_TO_21,
        MONDAY,
        [busy('2026-10-12T13:00:00Z', '2026-10-12T14:00:00Z'), busy('2026-10-12T14:00:00Z', '2026-10-12T15:00:00Z')],
        LONG_AGO,
      );

      expect(starts(day)).not.toContain('2026-10-12T13:00:00.000Z');
      expect(starts(day)).not.toContain('2026-10-12T14:00:00.000Z');
      expect(starts(day)).toContain('2026-10-12T12:00:00.000Z');
      expect(starts(day)).toContain('2026-10-12T15:00:00.000Z');
    });

    it('las horas que ya empezaron no se ofrecen y el día completo deja de estar disponible', () => {
      // Lunes a las 11:30 de Chile: el bloque de 11:00 ya empezó.
      const day = availabilityOfDay(MONDAY_9_TO_21, MONDAY, [], at('2026-10-12T14:30:00Z'));

      expect(starts(day)[0]).toBe('2026-10-12T15:00:00.000Z');
      expect(day.slots).toHaveLength(9);
      expect(day.fullDay).toEqual({
        startAt: at('2026-10-12T12:00:00Z'),
        endAt: at('2026-10-13T00:00:00Z'),
        available: false,
      });
    });

    it('un bloque que empieza justo ahora ya pasó', () => {
      const day = availabilityOfDay(MONDAY_9_TO_21, MONDAY, [], at('2026-10-12T15:00:00Z'));

      expect(starts(day)[0]).toBe('2026-10-12T16:00:00.000Z');
    });

    describe('un día con dos rangos y una pausa al medio', () => {
      const SPLIT = [rule(1, '09:00', '13:00'), rule(1, '15:00', '18:00')];

      it('no ofrece las horas de la pausa, pero el día completo la incluye', () => {
        const day = availabilityOfDay(SPLIT, MONDAY, [], LONG_AGO);

        expect(day.slots).toHaveLength(7);
        expect(starts(day)).not.toContain('2026-10-12T16:00:00.000Z');
        expect(starts(day)).not.toContain('2026-10-12T17:00:00.000Z');
        expect(day.fullDay).toEqual({
          startAt: at('2026-10-12T12:00:00Z'),
          endAt: at('2026-10-12T21:00:00Z'),
          available: true,
        });
      });

      it('una reserva que quedó en la pausa (el horario cambió después) deja el día completo no disponible', () => {
        const day = availabilityOfDay(SPLIT, MONDAY, [busy('2026-10-12T16:00:00Z', '2026-10-12T17:00:00Z')], LONG_AGO);

        expect(day.slots).toHaveLength(7);
        expect(day.fullDay?.available).toBe(false);
      });
    });

    it('una reserva que cruza la medianoche ocupa horas de los dos días', () => {
      const rules = [rule(1, '20:00', '24:00'), rule(2, '00:00', '04:00')];
      // De las 22:00 del lunes a las 02:00 del martes, en Chile.
      const overnight = [busy('2026-10-13T01:00:00Z', '2026-10-13T05:00:00Z')];

      const monday = availabilityOfDay(rules, MONDAY, overnight, LONG_AGO);
      const tuesday = availabilityOfDay(rules, { year: 2026, month: 10, day: 13 }, overnight, LONG_AGO);

      expect(starts(monday)).toEqual(['2026-10-12T23:00:00.000Z', '2026-10-13T00:00:00.000Z']);
      expect(starts(tuesday)).toEqual(['2026-10-13T05:00:00.000Z', '2026-10-13T06:00:00.000Z']);
    });

    it('el día se mide en Chile: el lunes de 21:00 a 24:00 cae en el martes UTC, pero es del lunes', () => {
      const rules = [rule(1, '21:00', '24:00')];

      const monday = availabilityOfDay(rules, MONDAY, [], LONG_AGO);
      const tuesday = availabilityOfDay(rules, { year: 2026, month: 10, day: 13 }, [], LONG_AGO);

      expect(starts(monday)).toEqual([
        '2026-10-13T00:00:00.000Z',
        '2026-10-13T01:00:00.000Z',
        '2026-10-13T02:00:00.000Z',
      ]);
      expect(tuesday).toEqual({ date: '2026-10-13', slots: [], fullDay: null });
    });

    it('el domingo de septiembre, sin medianoche, el día completo va de la 01:00 a las 24:00', () => {
      const day = availabilityOfDay([rule(0, '00:00', '24:00')], { year: 2026, month: 9, day: 6 }, [], LONG_AGO);

      expect(day.slots).toHaveLength(23);
      expect(day.fullDay).toEqual({
        startAt: at('2026-09-06T04:00:00Z'),
        endAt: at('2026-09-07T03:00:00Z'),
        available: true,
      });
    });

    it('el sábado de abril, de 25 horas, ofrece las dos 23:00 y el día completo dura 25 horas', () => {
      const day = availabilityOfDay([rule(6, '00:00', '24:00')], { year: 2026, month: 4, day: 4 }, [], LONG_AGO);

      expect(day.slots).toHaveLength(25);
      const { startAt, endAt } = day.fullDay!;
      expect(startAt).toEqual(at('2026-04-04T03:00:00Z'));
      expect(endAt).toEqual(at('2026-04-05T04:00:00Z'));
      expect((endAt.getTime() - startAt.getTime()) / 3_600_000).toBe(25);
    });
  });

  describe('isRangeAvailable', () => {
    const free = (startAt: string, endAt: string, held: BusyInterval[] = [], now = LONG_AGO, rules = MONDAY_9_TO_21) =>
      isRangeAvailable(rules, at(startAt), at(endAt), held, now);
    // De 10:00 a 12:00 del lunes en Chile.
    const TEN_TO_TWELVE = [busy('2026-10-12T13:00:00Z', '2026-10-12T15:00:00Z')];

    it('un rango libre dentro del horario está disponible', () => {
      expect(free('2026-10-12T12:00:00Z', '2026-10-13T00:00:00Z')).toBe(true);
      expect(free('2026-10-12T16:00:00Z', '2026-10-12T17:00:00Z')).toBe(true);
    });

    it('reservas contiguas: se puede reservar justo antes y justo después de otra, no encima', () => {
      expect(free('2026-10-12T12:00:00Z', '2026-10-12T13:00:00Z', TEN_TO_TWELVE)).toBe(true);
      expect(free('2026-10-12T15:00:00Z', '2026-10-12T17:00:00Z', TEN_TO_TWELVE)).toBe(true);
      expect(free('2026-10-12T14:00:00Z', '2026-10-12T16:00:00Z', TEN_TO_TWELVE)).toBe(false);
      expect(free('2026-10-12T12:00:00Z', '2026-10-12T16:00:00Z', TEN_TO_TWELVE)).toBe(false);
    });

    it('fuera del horario, o saliéndose por un extremo, no está disponible', () => {
      // Las 08:00 de Chile, antes de abrir.
      expect(free('2026-10-12T11:00:00Z', '2026-10-12T13:00:00Z')).toBe(false);
      // Hasta las 22:00, después de cerrar.
      expect(free('2026-10-12T23:00:00Z', '2026-10-13T01:00:00Z')).toBe(false);
      // El martes no se arrienda.
      expect(free('2026-10-13T12:00:00Z', '2026-10-13T13:00:00Z')).toBe(false);
    });

    it('no cruza una pausa del horario', () => {
      const split = [rule(1, '09:00', '13:00'), rule(1, '15:00', '18:00')];

      expect(free('2026-10-12T15:00:00Z', '2026-10-12T16:00:00Z', [], LONG_AGO, split)).toBe(true);
      expect(free('2026-10-12T15:00:00Z', '2026-10-12T19:00:00Z', [], LONG_AGO, split)).toBe(false);
      // Es el fullDay de ese día: tampoco, porque incluye la pausa (ver la nota de isAvailable).
      expect(free('2026-10-12T12:00:00Z', '2026-10-12T21:00:00Z', [], LONG_AGO, split)).toBe(false);
    });

    it('cruza la medianoche si el horario sigue al día siguiente', () => {
      const rules = [rule(1, '20:00', '24:00'), rule(2, '00:00', '04:00')];

      // De las 22:00 del lunes a las 02:00 del martes, en Chile.
      expect(free('2026-10-13T01:00:00Z', '2026-10-13T05:00:00Z', [], LONG_AGO, rules)).toBe(true);
      // Si el martes no abre de madrugada, no.
      expect(free('2026-10-13T01:00:00Z', '2026-10-13T05:00:00Z', [], LONG_AGO, [rule(1, '20:00', '24:00')])).toBe(false);
      // Y una reserva del martes a la 01:00 lo impide.
      const held = [busy('2026-10-13T04:00:00Z', '2026-10-13T05:00:00Z')];
      expect(free('2026-10-13T01:00:00Z', '2026-10-13T05:00:00Z', held, LONG_AGO, rules)).toBe(false);
    });

    it('un rango que ya empezó no está disponible, aunque termine en el futuro', () => {
      const now = at('2026-10-12T14:30:00Z');

      expect(free('2026-10-12T14:00:00Z', '2026-10-12T16:00:00Z', [], now)).toBe(false);
      expect(free('2026-10-12T12:00:00Z', '2026-10-12T13:00:00Z', [], now)).toBe(false);
      expect(free('2026-10-12T15:00:00Z', '2026-10-12T16:00:00Z', [], now)).toBe(true);
    });

    it('cruza el cambio de hora de septiembre sin perder ni duplicar horas', () => {
      const rules = [rule(6, '22:00', '24:00'), rule(0, '00:00', '03:00')];

      // Del sábado a las 22:00 (UTC-4) al domingo a las 03:00 (UTC-3): cuatro horas reales.
      expect(free('2026-09-06T02:00:00Z', '2026-09-06T06:00:00Z', [], LONG_AGO, rules)).toBe(true);
      expect(free('2026-09-06T02:00:00Z', '2026-09-06T07:00:00Z', [], LONG_AGO, rules)).toBe(false);
    });

    it('las dos 23:00 del sábado de abril se reservan juntas o por separado', () => {
      const rules = [rule(6, '23:00', '24:00')];

      expect(free('2026-04-05T02:00:00Z', '2026-04-05T04:00:00Z', [], LONG_AGO, rules)).toBe(true);
      expect(free('2026-04-05T03:00:00Z', '2026-04-05T04:00:00Z', [], LONG_AGO, rules)).toBe(true);
      expect(free('2026-04-05T03:00:00Z', '2026-04-05T05:00:00Z', [], LONG_AGO, rules)).toBe(false);
    });

    it.each([
      ['un fin igual al inicio', '2026-10-12T12:00:00Z', '2026-10-12T12:00:00Z'],
      ['un fin anterior al inicio', '2026-10-12T14:00:00Z', '2026-10-12T12:00:00Z'],
      ['minutos que no son una hora cerrada', '2026-10-12T12:30:00Z', '2026-10-12T13:30:00Z'],
      ['una fecha inválida', 'no-es-fecha', '2026-10-12T13:00:00Z'],
    ])('con %s no está disponible', (_name, startAt, endAt) => {
      expect(free(startAt, endAt)).toBe(false);
    });

    it('un rango de más de 31 días no está disponible, aunque el horario sea completo', () => {
      const always = [0, 1, 2, 3, 4, 5, 6].map((weekday) => rule(weekday, '00:00', '24:00'));

      expect(free('2026-10-01T03:00:00Z', '2026-11-01T03:00:00Z', [], LONG_AGO, always)).toBe(true);
      expect(free('2026-10-01T03:00:00Z', '2026-11-02T03:00:00Z', [], LONG_AGO, always)).toBe(false);
    });
  });
});

describe('isRangeAvailable con opciones', () => {
  const SPLIT = [rule(1, '09:00', '13:00'), rule(1, '15:00', '18:00')];
  const check = (
    rules: WeeklyRule[],
    startAt: string,
    endAt: string,
    options: Parameters<typeof isRangeAvailable>[5],
    held: BusyInterval[] = [],
    now = LONG_AGO,
  ) => isRangeAvailable(rules, at(startAt), at(endAt), held, now, options);

  describe("unit: 'DAY'", () => {
    it('el día con pausa se reserva entero si el rango es exactamente su fullDay', () => {
      // De 09:00 a 18:00 en Chile, con la pausa de 13:00 a 15:00 adentro.
      expect(check(SPLIT, '2026-10-12T12:00:00Z', '2026-10-12T21:00:00Z', { unit: 'DAY' })).toBe(true);
      // Por hora, el mismo rango no cabe: cruza la pausa.
      expect(check(SPLIT, '2026-10-12T12:00:00Z', '2026-10-12T21:00:00Z', { unit: 'HOUR' })).toBe(false);
    });

    it('coincide con fullDay.available del endpoint', () => {
      const cases: BusyInterval[][] = [
        [],
        [busy('2026-10-12T13:00:00Z', '2026-10-12T14:00:00Z')],
        // Una reserva en la pausa.
        [busy('2026-10-12T16:00:00Z', '2026-10-12T17:00:00Z')],
      ];
      for (const held of cases) {
        const { fullDay } = availabilityOfDay(SPLIT, MONDAY, held, LONG_AGO);
        const day = isRangeAvailable(SPLIT, fullDay!.startAt, fullDay!.endAt, held, LONG_AGO, { unit: 'DAY' });
        expect(day).toBe(fullDay!.available);
      }
    });

    it('una reserva en la pausa impide el día completo, aunque las horas del horario estén libres', () => {
      const held = [busy('2026-10-12T16:00:00Z', '2026-10-12T17:00:00Z')];

      expect(check(SPLIT, '2026-10-12T12:00:00Z', '2026-10-12T21:00:00Z', { unit: 'DAY' }, held)).toBe(false);
    });

    it.each([
      ['empieza una hora tarde', '2026-10-12T13:00:00Z', '2026-10-12T21:00:00Z'],
      ['termina una hora antes', '2026-10-12T12:00:00Z', '2026-10-12T20:00:00Z'],
      ['se pasa del horario', '2026-10-12T12:00:00Z', '2026-10-12T22:00:00Z'],
      ['es un día que no se arrienda', '2026-10-13T12:00:00Z', '2026-10-13T21:00:00Z'],
    ])('es falso si el rango no es exactamente el fullDay: %s', (_name, startAt, endAt) => {
      expect(check(SPLIT, startAt, endAt, { unit: 'DAY' })).toBe(false);
    });

    it('sirve en los días de 23 y 25 horas', () => {
      const always = [rule(0, '00:00', '24:00'), rule(6, '00:00', '24:00')];

      expect(check(always, '2026-09-06T04:00:00Z', '2026-09-07T03:00:00Z', { unit: 'DAY' })).toBe(true);
      expect(check(always, '2026-04-04T03:00:00Z', '2026-04-05T04:00:00Z', { unit: 'DAY' })).toBe(true);
    });

    it('un día que ya empezó no se reserva', () => {
      expect(
        check(SPLIT, '2026-10-12T12:00:00Z', '2026-10-12T21:00:00Z', { unit: 'DAY' }, [], at('2026-10-12T12:30:00Z')),
      ).toBe(false);
    });
  });

  describe('allowStarted', () => {
    // Lunes a las 10:02 en Chile: el bloque de 10:00 ya empezó.
    const NOW_10_02 = at('2026-10-12T13:02:00Z');

    it('acepta un rango que ya empezó y no ha terminado', () => {
      expect(check(MONDAY_9_TO_21, '2026-10-12T13:00:00Z', '2026-10-12T14:00:00Z', {}, [], NOW_10_02)).toBe(false);
      expect(
        check(MONDAY_9_TO_21, '2026-10-12T13:00:00Z', '2026-10-12T14:00:00Z', { allowStarted: true }, [], NOW_10_02),
      ).toBe(true);
    });

    it('un rango que ya terminó sigue siendo falso', () => {
      expect(
        check(MONDAY_9_TO_21, '2026-10-12T12:00:00Z', '2026-10-12T13:00:00Z', { allowStarted: true }, [], NOW_10_02),
      ).toBe(false);
      // Termina justo ahora.
      expect(
        check(
          MONDAY_9_TO_21,
          '2026-10-12T12:00:00Z',
          '2026-10-12T13:00:00Z',
          { allowStarted: true },
          [],
          at('2026-10-12T13:00:00Z'),
        ),
      ).toBe(false);
    });

    it('también vale para un día completo que ya empezó', () => {
      expect(
        check(SPLIT, '2026-10-12T12:00:00Z', '2026-10-12T21:00:00Z', { unit: 'DAY', allowStarted: true }, [], NOW_10_02),
      ).toBe(true);
    });

    it('no salta el horario ni las reservas', () => {
      const held = [busy('2026-10-12T13:00:00Z', '2026-10-12T14:00:00Z')];

      expect(
        check(MONDAY_9_TO_21, '2026-10-12T13:00:00Z', '2026-10-12T14:00:00Z', { allowStarted: true }, held, NOW_10_02),
      ).toBe(false);
    });
  });
});
