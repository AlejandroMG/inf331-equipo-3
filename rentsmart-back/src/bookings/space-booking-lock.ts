import type { Prisma } from '../generated/prisma/client';

/**
 * Pone en fila, por espacio, las transacciones que crean una reserva (RE-03). Toma un advisory lock de transacción de
 * Postgres con la clave `hashtextextended(spaceId, 0)`; se suelta solo con el COMMIT o el ROLLBACK.
 *
 * Por qué hace falta: con read committed, dos reservas simultáneas del mismo horario pasan las dos `isAvailable`, y
 * dos `INSERT` simultáneos contra la restricción de exclusión `booking_no_overlap` no siempre terminan en una
 * violación (23P01): Postgres puede abortar uno con un deadlock (40P01), que llega como `P2034` y sería un 500 (ver
 * «Exclusion Constraints» en `execIndexing.c`). Con el lock, la segunda espera el COMMIT de la primera y su
 * `isAvailable` ya ve el horario tomado: responde el 409 de siempre, sin carrera y sin deadlock.
 *
 * Por qué un advisory lock y no `SELECT … FOR UPDATE` sobre `Space`: no bloquea la fila del espacio, que editan otros
 * módulos (B), y solo compite con otras reservas del mismo espacio. Que dos ids distintos den la misma clave de 64
 * bits es casi imposible y solo pondría en fila a dos espacios, sin romper nada.
 *
 * El id va como parámetro de la consulta, nunca dentro del texto SQL.
 */
export async function lockSpaceForBooking(tx: Prisma.TransactionClient, spaceId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${spaceId}, 0))`;
}
