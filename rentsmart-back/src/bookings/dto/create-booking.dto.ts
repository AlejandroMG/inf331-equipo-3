import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { BookingUnit } from '../../generated/prisma/enums';

/** Un instante UTC en una hora cerrada (P-07): `2026-10-12T12:00:00.000Z`. Chile va a horas enteras de UTC. */
export const HOUR_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:00:00(\.0{1,3})?Z$/;

export class CreateBookingDto {
  @ApiProperty({ description: 'El espacio que se reserva (id de GET /api/catalog)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  spaceId: string;

  @ApiProperty({
    example: '2026-10-12T12:00:00.000Z',
    description: 'Inicio en UTC, en una hora cerrada. Sale de GET /api/spaces/:id/availability',
  })
  @Matches(HOUR_UTC_PATTERN, { message: 'startAt debe ser una hora cerrada en UTC (AAAA-MM-DDTHH:00:00.000Z)' })
  @IsISO8601({ strict: true }, { message: 'startAt debe ser una fecha que exista' })
  startAt: string;

  @ApiProperty({
    example: '2026-10-12T14:00:00.000Z',
    description: 'Fin en UTC, en una hora cerrada posterior al inicio',
  })
  @Matches(HOUR_UTC_PATTERN, { message: 'endAt debe ser una hora cerrada en UTC (AAAA-MM-DDTHH:00:00.000Z)' })
  @IsISO8601({ strict: true }, { message: 'endAt debe ser una fecha que exista' })
  endAt: string;

  @ApiProperty({
    enum: BookingUnit,
    description:
      '`HOUR` cobra el precio por hora por cada bloque. `DAY` cobra el precio por día y exige el `fullDay` completo de ese día',
  })
  @IsIn(Object.values(BookingUnit))
  unit: BookingUnit;
}
