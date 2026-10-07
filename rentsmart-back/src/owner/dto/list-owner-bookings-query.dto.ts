import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { BookingStatus } from '../../generated/prisma/enums';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
/** Una fecha del calendario, `2026-10-03`: se entiende en la hora de Chile. */
export const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export class ListOwnerBookingsQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: DEFAULT_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({
    enum: BookingStatus,
    description: 'Solo las reservas en este estado',
  })
  @IsOptional()
  @IsIn(Object.values(BookingStatus))
  status?: BookingStatus;

  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'Reservas que empiezan desde este día (incluido), hora de Chile',
  })
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'from debe ser una fecha AAAA-MM-DD' })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-10-31',
    description: 'Reservas que empiezan hasta este día (incluido), hora de Chile',
  })
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'to debe ser una fecha AAAA-MM-DD' })
  to?: string;

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    default: 'desc',
    description: 'Orden por fecha de inicio: las más lejanas primero (desc) o las más próximas (asc)',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort: 'asc' | 'desc' = 'desc';
}
