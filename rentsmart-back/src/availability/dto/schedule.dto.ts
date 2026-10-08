import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, Matches, Max, Min, ValidateNested } from 'class-validator';

/** Horas cerradas (P-07). El inicio va de 00:00 a 23:00 y el fin de 01:00 a 24:00. */
export const START_TIME_PATTERN = /^([01]\d|2[0-3]):00$/;
export const END_TIME_PATTERN = /^(0[1-9]|1\d|2[0-4]):00$/;
/** Un tope holgado: 7 días con varios rangos cada uno. */
export const MAX_SCHEDULE_RULES = 50;

/** Un rango del horario semanal, en hora de Chile. */
export class ScheduleRuleDto {
  @ApiProperty({ example: 1, minimum: 0, maximum: 6, description: '0 = domingo ... 6 = sábado' })
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @ApiProperty({ example: '09:00', description: 'Hora cerrada, de 00:00 a 23:00' })
  @Matches(START_TIME_PATTERN, { message: 'startTime debe ser una hora cerrada (HH:00)' })
  startTime: string;

  @ApiProperty({ example: '21:00', description: 'Hora cerrada posterior al inicio, de 01:00 a 24:00' })
  @Matches(END_TIME_PATTERN, { message: 'endTime debe ser una hora cerrada (HH:00)' })
  endTime: string;
}

export class ReplaceScheduleDto {
  @ApiProperty({
    type: [ScheduleRuleDto],
    description:
      'El horario completo: reemplaza al anterior. Un día puede tener varios rangos, sin traslaparse. Los días que no aparecen no se arriendan',
  })
  @IsArray()
  @ArrayMaxSize(MAX_SCHEDULE_RULES)
  @ValidateNested({ each: true })
  @Type(() => ScheduleRuleDto)
  rules: ScheduleRuleDto[];
}

/** El horario semanal de un espacio. */
export class ScheduleDto {
  @ApiProperty({ type: [ScheduleRuleDto], description: 'Por día de la semana y hora de inicio' })
  rules: ScheduleRuleDto[];
}
