import { bookingAmounts, FEE_PERCENT } from './pricing';

const HOUR = 3_600_000;
const START = new Date('2030-10-14T12:00:00.000Z');
const after = (hours: number) => new Date(START.getTime() + hours * HOUR);

describe('bookingAmounts', () => {
  it('la comisión es del 10 % (P-13)', () => {
    expect(FEE_PERCENT).toBe(10);
  });

  it('por hora cobra el precio por hora por cada bloque y suma la comisión', () => {
    expect(bookingAmounts({ pricePerHour: 12000, pricePerDay: 90000 }, 'HOUR', START, after(2))).toEqual({
      subtotal: 24000,
      fee: 2400,
      total: 26400,
    });
  });

  it('por día cobra el precio por día, dure lo que dure el día', () => {
    expect(bookingAmounts({ pricePerHour: 12000, pricePerDay: 90000 }, 'DAY', START, after(12))).toEqual({
      subtotal: 90000,
      fee: 9000,
      total: 99000,
    });
    expect(bookingAmounts({ pricePerHour: null, pricePerDay: 90000 }, 'DAY', START, after(5)).subtotal).toBe(90000);
  });

  it.each([
    [12345, 1235], // 1234,5 sube
    [12344, 1234], // 1234,4 baja
    [5, 1], // 0,5 sube, igual que Math.round del mock del front
    [4, 0],
  ])('redondea la comisión de %i a %i CLP enteros', (subtotal, fee) => {
    expect(bookingAmounts({ pricePerHour: subtotal, pricePerDay: null }, 'HOUR', START, after(1))).toEqual({
      subtotal,
      fee,
      total: subtotal + fee,
    });
  });

  it('montos grandes siguen siendo enteros exactos', () => {
    const amounts = bookingAmounts({ pricePerHour: 9_999_999, pricePerDay: null }, 'HOUR', START, after(24));

    expect(amounts).toEqual({ subtotal: 239_999_976, fee: 23_999_998, total: 263_999_974 });
    expect(Number.isInteger(amounts.fee)).toBe(true);
  });

  it('lanza si el espacio no tiene precio en esa unidad o el rango no son horas enteras', () => {
    expect(() => bookingAmounts({ pricePerHour: null, pricePerDay: 90000 }, 'HOUR', START, after(1))).toThrow();
    expect(() => bookingAmounts({ pricePerHour: 12000, pricePerDay: null }, 'DAY', START, after(1))).toThrow();
    expect(() => bookingAmounts({ pricePerHour: 12000, pricePerDay: null }, 'HOUR', START, START)).toThrow();
    expect(() =>
      bookingAmounts({ pricePerHour: 12000, pricePerDay: null }, 'HOUR', START, new Date(START.getTime() + HOUR / 2)),
    ).toThrow();
  });
});
