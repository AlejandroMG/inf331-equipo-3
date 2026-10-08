import { ApiProperty } from '@nestjs/swagger';

/** Un bloque libre de una hora. */
export class AvailabilitySlotDto {
  @ApiProperty({ type: Date, example: '2026-10-12T12:00:00.000Z', description: 'UTC' })
  startAt: Date;

  @ApiProperty({ type: Date, example: '2026-10-12T13:00:00.000Z', description: 'UTC' })
  endAt: Date;
}

/** Lo que toma una reserva "por día": todo el horario de ese día (P-07). */
export class FullDayDto {
  @ApiProperty({ type: Date, example: '2026-10-12T12:00:00.000Z', description: 'Inicio del horario del día, UTC' })
  startAt: Date;

  @ApiProperty({ type: Date, example: '2026-10-13T00:00:00.000Z', description: 'Fin del horario del día, UTC' })
  endAt: Date;

  @ApiProperty({ description: 'false si alguna hora del día ya está ocupada o ya pasó' })
  available: boolean;
}

export class AvailabilityDayDto {
  @ApiProperty({ example: '2026-10-12', description: 'Día del calendario, hora de Chile' })
  date: string;

  @ApiProperty({
    type: [AvailabilitySlotDto],
    description: 'Bloques libres de una hora, en orden. Vacío si el día no se arrienda o está completo',
  })
  slots: AvailabilitySlotDto[];

  @ApiProperty({
    type: FullDayDto,
    nullable: true,
    description:
      'El `startAt` y el `endAt` que se mandan para reservar el día completo; null si ese día no tiene horario',
  })
  fullDay: FullDayDto | null;
}

/** Disponibilidad de un espacio entre dos días. */
export class AvailabilityDto {
  @ApiProperty()
  spaceId: string;

  @ApiProperty({ example: 'America/Santiago', description: 'Zona en que se miden los días' })
  timeZone: string;

  @ApiProperty({ type: [AvailabilityDayDto], description: 'Un elemento por día pedido, en orden' })
  days: AvailabilityDayDto[];
}
