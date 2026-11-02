import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { isOverlapViolation, OVERLAP_MESSAGE, overlapAsConflict } from './overlap-error';
import { overlapViolation } from './overlap-error.fixture';

describe('isOverlapViolation', () => {
  it('reconoce el error real de Prisma cuando booking_no_overlap rechaza el INSERT', () => {
    expect(isOverlapViolation(overlapViolation())).toBe(true);
  });

  it('no depende del idioma de Postgres: basta el SQLSTATE y el nombre de la restricción en el mensaje', () => {
    const spanish = overlapViolation({
      message: 'llave en conflicto viola restricción de exclusión «booking_no_overlap»',
    });

    expect(isOverlapViolation(spanish)).toBe(true);
  });

  it('no depende del código de Prisma, que es genérico para los errores de la base', () => {
    expect(isOverlapViolation(overlapViolation({}, 'P2010'))).toBe(true);
  });

  it.each([
    ['otra restricción de exclusión', overlapViolation({ message: 'violates exclusion constraint "otra_restriccion"' })],
    [
      'una restricción cuyo nombre solo empieza igual',
      overlapViolation({ message: 'violates exclusion constraint "booking_no_overlap_v2"' }),
    ],
    [
      'otro SQLSTATE aunque nombre la restricción',
      overlapViolation({ code: '23514', message: 'violates check constraint "booking_no_overlap"' }),
    ],
    ['un índice único (P2002)', new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '7.10.0' })],
    [
      'un error de Prisma sin driverAdapterError',
      new Prisma.PrismaClientKnownRequestError('booking_no_overlap', { code: 'P2039', clientVersion: '7.10.0', meta: {} }),
    ],
    ['un Error cualquiera que nombra la restricción', new Error('exclusion constraint "booking_no_overlap" 23P01')],
    [
      'un objeto con la misma forma que no es un error de Prisma',
      { name: 'PrismaClientKnownRequestError', code: 'P2039', meta: overlapViolation().meta },
    ],
    ['null', null],
    ['undefined', undefined],
    ['un texto', 'booking_no_overlap'],
  ])('rechaza %s', (_name, error) => {
    expect(isOverlapViolation(error)).toBe(false);
  });
});

describe('overlapAsConflict', () => {
  it('convierte la violación de booking_no_overlap en un 409', () => {
    const error = (() => {
      try {
        overlapAsConflict(overlapViolation());
      } catch (e) {
        return e;
      }
    })();

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).message).toBe(OVERLAP_MESSAGE);
  });

  it('deja pasar cualquier otro error tal cual', () => {
    const other = new Error('Stripe no responde');

    expect(() => overlapAsConflict(other)).toThrow(other);
  });
});
