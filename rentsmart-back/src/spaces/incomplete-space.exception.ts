import { ConflictException } from '@nestjs/common';
import { MissingField } from './publish-rules';

/**
 * 409: el espacio no cumple lo necesario para publicarse. Además del mensaje, la respuesta trae
 * `missing` con lo que falta, para que la pantalla indique exactamente qué completar.
 */
export class IncompleteSpaceException extends ConflictException {
  constructor(
    readonly missing: MissingField[],
    message = 'Faltan datos para publicar el espacio',
  ) {
    super({ statusCode: 409, error: 'Conflict', message, missing });
  }
}
