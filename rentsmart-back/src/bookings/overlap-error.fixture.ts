import { Prisma } from '../generated/prisma/client';

/** El mensaje con que Postgres rechaza una reserva traslapada (con `lc_messages` en inglés). */
const POSTGRES_MESSAGE = 'conflicting key value violates exclusion constraint "booking_no_overlap"';

/**
 * Solo para los tests. El error que entrega Prisma 7 con `@prisma/adapter-pg` cuando `booking_no_overlap` rechaza un
 * `INSERT`, copiado de uno real capturado en `test/booking-overlap.e2e-spec.ts` (sin el `detail`, que trae ids y
 * fechas). El adapter no reconoce el SQLSTATE 23P01, así que lo deja como `kind: "postgres"` y el nombre de la
 * restricción solo viene en el mensaje. `cause` permite cambiar el código o el mensaje para armar otros errores.
 */
export function overlapViolation(
  cause: { code?: string; message?: string } = {},
  code = 'P2039',
): Prisma.PrismaClientKnownRequestError {
  const pgCode = cause.code ?? '23P01';
  const pgMessage = cause.message ?? POSTGRES_MESSAGE;
  return new Prisma.PrismaClientKnownRequestError(
    `Invalid \`prisma.booking.create()\` invocation:\n\nDatabase error. Code: \`${pgCode}\`. Message: \`${pgMessage}\``,
    {
      code,
      clientVersion: '7.10.0',
      meta: {
        modelName: 'Booking',
        driverAdapterError: {
          name: 'DriverAdapterError',
          cause: {
            originalCode: pgCode,
            originalMessage: pgMessage,
            kind: 'postgres',
            code: pgCode,
            severity: 'ERROR',
            message: pgMessage,
          },
        },
      },
    },
  );
}
