import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';

/** La restricción de exclusión que impide dos reservas activas traslapadas del mismo espacio (migración `booking_no_overlap`). */
export const OVERLAP_CONSTRAINT = 'booking_no_overlap';

/** SQLSTATE de Postgres para una violación de una restricción de exclusión. */
const EXCLUSION_VIOLATION = '23P01';

/** El 409 cuando la base rechaza la reserva: otra solicitud tomó el horario entre la revisión y el `INSERT`. */
export const OVERLAP_MESSAGE = 'Alguien acaba de reservar ese horario; elige otro';

/** El nombre de la restricción como palabra completa: no confunde `booking_no_overlap_v2`. */
const CONSTRAINT_NAME = new RegExp(`(^|[^A-Za-z0-9_])${OVERLAP_CONSTRAINT}([^A-Za-z0-9_]|$)`);

/**
 * Si `error` es la violación de `booking_no_overlap` (RE-03), y solo esa.
 *
 * Con Prisma 7 y `@prisma/adapter-pg` llega como `PrismaClientKnownRequestError` con un código genérico (`P2039`)
 * y el error del driver en `meta.driverAdapterError.cause`. El adapter no traduce el SQLSTATE 23P01, así que deja
 * `kind: "postgres"`, el código y el mensaje, sin un campo con el nombre de la restricción: se reconoce por el
 * SQLSTATE (que no depende del idioma de Postgres) y por el nombre dentro del mensaje. No se mira el código de Prisma.
 */
export function isOverlapViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const adapterError = error.meta?.driverAdapterError as { cause?: Record<string, unknown> } | undefined;
  const cause = adapterError?.cause;
  if (!cause) return false;
  const code = cause.originalCode ?? cause.code;
  const message = cause.originalMessage ?? cause.message;
  return code === EXCLUSION_VIOLATION && typeof message === 'string' && CONSTRAINT_NAME.test(message);
}

/** Para un `.catch`: convierte la violación de `booking_no_overlap` en un 409 y deja pasar cualquier otro error. */
export function overlapAsConflict(error: unknown): never {
  if (isOverlapViolation(error)) throw new ConflictException(OVERLAP_MESSAGE);
  throw error;
}
