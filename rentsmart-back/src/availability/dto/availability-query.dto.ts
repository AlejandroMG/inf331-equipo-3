import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

/** Una fecha del calendario, `2026-10-12`: se entiende en la hora de Chile. */
export const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
/** Cuántos días se pueden pedir de una vez, contando los dos extremos. */
export const MAX_AVAILABILITY_DAYS = 31;

export class AvailabilityQueryDto {
  @ApiProperty({
    example: '2026-10-12',
    description: 'Primer día (incluido), hora de Chile',
  })
  @Matches(DATE_PATTERN, { message: 'from debe ser una fecha AAAA-MM-DD' })
  from: string;

  @ApiProperty({
    example: '2026-10-18',
    description: `Último día (incluido), hora de Chile. Hasta ${MAX_AVAILABILITY_DAYS} días desde from`,
  })
  @Matches(DATE_PATTERN, { message: 'to debe ser una fecha AAAA-MM-DD' })
  to: string;
}
