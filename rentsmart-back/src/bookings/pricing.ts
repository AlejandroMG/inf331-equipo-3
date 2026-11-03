import { BookingUnit } from '../generated/prisma/enums';

/**
 * Comisión de la plataforma, en porcentaje del subtotal, sumada a lo que paga el arrendatario (P-13). Es el único
 * lugar del back donde está; el mock del front (`src/mocks/bookings-handlers.ts`) usa el mismo 10 %.
 */
export const FEE_PERCENT = 10;

const HOUR_MS = 3_600_000;

/** Los precios del espacio, en CLP enteros. Un espacio se arrienda en una unidad solo si tiene ese precio (P-07). */
export interface SpacePrices {
  pricePerHour: number | null;
  pricePerDay: number | null;
}

/** El desglose de una reserva, en CLP enteros: `total = subtotal + fee`. */
export interface BookingAmounts {
  subtotal: number;
  fee: number;
  total: number;
}

/** El precio del espacio en esa unidad, o null si no se arrienda así. */
export function priceFor(prices: SpacePrices, unit: BookingUnit): number | null {
  return unit === BookingUnit.DAY ? prices.pricePerDay : prices.pricePerHour;
}

/**
 * Cuánto cuesta una reserva. `HOUR` cobra el precio por hora por cada bloque de una hora; `DAY`, el precio por día
 * aunque el horario de ese día sea más corto (P-07). La comisión se redondea al peso, con `Math.round`, igual que el
 * mock del front. Es una función pura: quien llama ya revisó que el espacio tenga precio en esa unidad y que el rango
 * sean horas cerradas; si no, lanza un `Error` (es un error de programación, no un 400).
 */
export function bookingAmounts(prices: SpacePrices, unit: BookingUnit, startAt: Date, endAt: Date): BookingAmounts {
  const price = priceFor(prices, unit);
  if (price === null) throw new Error(`El espacio no tiene precio por ${unit}`);
  const hours = (endAt.getTime() - startAt.getTime()) / HOUR_MS;
  if (!Number.isInteger(hours) || hours < 1) throw new Error('Una reserva dura una o más horas enteras');

  const subtotal = unit === BookingUnit.DAY ? price : price * hours;
  const fee = Math.round((subtotal * FEE_PERCENT) / 100);
  return { subtotal, fee, total: subtotal + fee };
}
