import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export const MIN_CANCEL_REASON = 5;
export const MAX_CANCEL_REASON = 500;

export class CancelBookingDto {
  @ApiProperty({
    minLength: MIN_CANCEL_REASON,
    maxLength: MAX_CANCEL_REASON,
    example: 'Se suspendió la reunión',
    description: 'Por qué se cancela. Queda en el historial de la reserva',
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(MIN_CANCEL_REASON)
  @MaxLength(MAX_CANCEL_REASON)
  reason: string;
}
