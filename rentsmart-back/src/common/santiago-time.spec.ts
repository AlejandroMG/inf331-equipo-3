import {
  daysInMonth,
  hoursBetween,
  santiagoMonthOf,
  santiagoMonthRange,
  santiagoStartOfDay,
  weekdayOf,
} from './santiago-time';

describe('santiago-time', () => {
  describe('santiagoStartOfDay', () => {
    it('en invierno (UTC-4) el día empieza a las 04:00 UTC', () => {
      expect(santiagoStartOfDay(2026, 7, 1).toISOString()).toBe(
        '2026-07-01T04:00:00.000Z',
      );
    });

    it('en verano (UTC-3) el día empieza a las 03:00 UTC', () => {
      expect(santiagoStartOfDay(2026, 1, 1).toISOString()).toBe(
        '2026-01-01T03:00:00.000Z',
      );
      expect(santiagoStartOfDay(2026, 10, 1).toISOString()).toBe(
        '2026-10-01T03:00:00.000Z',
      );
    });

    it('acepta un día fuera del mes: el día 32 es el 1 del mes siguiente', () => {
      expect(santiagoStartOfDay(2026, 10, 32).toISOString()).toBe(
        santiagoStartOfDay(2026, 11, 1).toISOString(),
      );
    });

    it('un mes 13 es enero del año siguiente', () => {
      expect(santiagoStartOfDay(2026, 13, 1).toISOString()).toBe(
        santiagoStartOfDay(2027, 1, 1).toISOString(),
      );
    });
  });

  describe('santiagoMonthRange', () => {
    it('va del primer instante del mes al primero del siguiente, sin solaparse', () => {
      const october = santiagoMonthRange(2026, 10);
      const november = santiagoMonthRange(2026, 11);

      expect(october.start.toISOString()).toBe('2026-10-01T03:00:00.000Z');
      expect(october.end.toISOString()).toBe(november.start.toISOString());
    });

    it('un mes que cambia de horario dura una hora más o menos que las 24 h por día', () => {
      // En Chile el horario de verano empieza en septiembre: septiembre dura 24 h menos 1 h.
      const september = santiagoMonthRange(2026, 9);
      const hours =
        (september.end.getTime() - september.start.getTime()) / 3_600_000;

      expect(hours).toBe(30 * 24 - 1);
    });

    it('diciembre termina en enero del año siguiente', () => {
      expect(santiagoMonthRange(2026, 12).end.toISOString()).toBe(
        '2027-01-01T03:00:00.000Z',
      );
    });
  });

  describe('santiagoMonthOf', () => {
    it('el mes se mide en Chile, no en UTC', () => {
      // 2026-10-01 02:30 UTC es el 30 de septiembre a las 23:30 en Chile (UTC-3).
      expect(santiagoMonthOf(new Date('2026-10-01T02:30:00Z'))).toEqual({
        year: 2026,
        month: 9,
      });
      expect(santiagoMonthOf(new Date('2026-10-01T03:00:00Z'))).toEqual({
        year: 2026,
        month: 10,
      });
    });
  });

  describe('calendario', () => {
    it('daysInMonth respeta los años bisiestos', () => {
      expect(daysInMonth(2026, 2)).toBe(28);
      expect(daysInMonth(2028, 2)).toBe(29);
      expect(daysInMonth(2026, 10)).toBe(31);
      expect(daysInMonth(2026, 11)).toBe(30);
    });

    it('weekdayOf da 0 para el domingo', () => {
      expect(weekdayOf(2026, 10, 4)).toBe(0); // domingo
      expect(weekdayOf(2026, 10, 5)).toBe(1); // lunes
      expect(weekdayOf(2026, 10, 10)).toBe(6); // sábado
    });
  });

  describe('hoursBetween', () => {
    it.each([
      ['09:00', '21:00', 12],
      ['09:30', '10:00', 0.5],
      ['00:00', '24:00', 24],
      ['21:00', '09:00', 0],
    ])('de %s a %s son %d horas', (start, end, hours) => {
      expect(hoursBetween(start, end)).toBe(hours);
    });
  });
});
