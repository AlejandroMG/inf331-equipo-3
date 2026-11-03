import {
  daysInMonth,
  hoursBetween,
  santiagoMonthOf,
  santiagoMonthRange,
  santiagoStartOfDay,
  santiagoWallClock,
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

    // El sábado 5 de septiembre de 2026 a las 24:00 se adelanta la hora: la medianoche del domingo 6 no existe.
    it('el domingo de septiembre sin medianoche empieza a la 01:00 de Chile (04:00 UTC)', () => {
      expect(santiagoStartOfDay(2026, 9, 5).toISOString()).toBe(
        '2026-09-05T04:00:00.000Z',
      );
      // Antes daba las 03:00 UTC, que son las 23:00 del sábado.
      expect(santiagoStartOfDay(2026, 9, 6).toISOString()).toBe(
        '2026-09-06T04:00:00.000Z',
      );
      expect(santiagoStartOfDay(2026, 9, 7).toISOString()).toBe(
        '2026-09-07T03:00:00.000Z',
      );
    });

    // El sábado 4 de abril de 2026 a las 24:00 se atrasa la hora: las 23:00 del sábado se repiten.
    it('alrededor del cambio de abril cada día empieza en su medianoche, y el sábado dura 25 horas', () => {
      const saturday = santiagoStartOfDay(2026, 4, 4);
      const sunday = santiagoStartOfDay(2026, 4, 5);

      expect(saturday.toISOString()).toBe('2026-04-04T03:00:00.000Z');
      expect(sunday.toISOString()).toBe('2026-04-05T04:00:00.000Z');
      expect((sunday.getTime() - saturday.getTime()) / 3_600_000).toBe(25);
      expect(santiagoStartOfDay(2026, 4, 6).toISOString()).toBe(
        '2026-04-06T04:00:00.000Z',
      );
    });
  });

  describe('santiagoWallClock', () => {
    it('da la fecha y la hora que marca el reloj en Chile', () => {
      // 2026-10-13 01:30 UTC es el lunes 12 a las 22:30 en Chile (UTC-3).
      expect(santiagoWallClock(new Date('2026-10-13T01:30:00Z'))).toEqual({
        year: 2026,
        month: 10,
        day: 12,
        hour: 22,
      });
      expect(santiagoWallClock(Date.parse('2026-07-01T13:00:00Z'))).toEqual({
        year: 2026,
        month: 7,
        day: 1,
        hour: 9,
      });
    });

    it('en los cambios de hora salta la medianoche de septiembre y repite las 23:00 de abril', () => {
      expect(santiagoWallClock(Date.parse('2026-09-06T03:00:00Z')).hour).toBe(23);
      expect(santiagoWallClock(Date.parse('2026-09-06T04:00:00Z'))).toEqual({
        year: 2026,
        month: 9,
        day: 6,
        hour: 1,
      });
      expect(santiagoWallClock(Date.parse('2026-04-05T02:00:00Z')).hour).toBe(23);
      expect(santiagoWallClock(Date.parse('2026-04-05T03:00:00Z'))).toEqual({
        year: 2026,
        month: 4,
        day: 4,
        hour: 23,
      });
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
