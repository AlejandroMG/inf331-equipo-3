import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import { SpaceStatus } from '../../generated/prisma/enums';

export const MONTH_PATTERN = /^(20\d{2})-(0[1-9]|1[0-2])$/;

export class OwnerMetricsQueryDto {
  @ApiPropertyOptional({
    example: '2026-10',
    description: 'El mes, AAAA-MM, en la hora de Chile. Sin él, el mes actual',
  })
  @IsOptional()
  @Matches(MONTH_PATTERN, { message: 'month debe ser un mes AAAA-MM' })
  month?: string;
}

export class SpaceMetricsDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Sala Alameda' })
  name: string;

  @ApiProperty({ enum: SpaceStatus })
  status: SpaceStatus;

  @ApiProperty({ example: 144000, description: 'CLP: lo recibido por reservas del mes' })
  income: number;

  @ApiProperty({ example: 4 })
  bookings: number;

  @ApiProperty({ example: 12, description: 'Horas reservadas en el mes' })
  bookedHours: number;

  @ApiProperty({
    example: 264,
    description: 'Horas arrendables en el mes según su horario semanal',
  })
  availableHours: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 0.05,
    description: 'Horas reservadas sobre las arrendables, de 0 a 1; null si no tiene horario',
  })
  occupancy: number | null;
}

export class OwnerMetricsDto {
  @ApiProperty({ example: '2026-10' })
  month: string;

  @ApiProperty({ example: 288000, description: 'CLP: ingresos del mes de todos mis espacios' })
  income: number;

  @ApiProperty({ example: 8 })
  bookings: number;

  @ApiProperty({ type: [SpaceMetricsDto], description: 'Por espacio publicado alguna vez, por nombre' })
  spaces: SpaceMetricsDto[];
}
