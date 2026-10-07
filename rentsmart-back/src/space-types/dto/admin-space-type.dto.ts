import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export const MIN_NAME = 2;
export const MAX_NAME = 60;

/** Un tipo de espacio con cuántos espacios lo usan. */
export class AdminSpaceTypeDto {
  @ApiProperty({ example: 3 })
  id: number;

  @ApiProperty({ example: 'Sala de ensayo' })
  name: string;

  @ApiProperty({ example: 4, description: 'Cuántos espacios (de cualquier estado) son de este tipo' })
  spaces: number;
}

export class SpaceTypeNameDto {
  @ApiProperty({
    minLength: MIN_NAME,
    maxLength: MAX_NAME,
    example: 'Estudio de danza',
    description:
      'Sin espacios de más al principio, al final ni repetidos. No puede repetir otro tipo (sin distinguir mayúsculas ni tildes) ni ser un alojamiento (P-08)',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString()
  @MinLength(MIN_NAME)
  @MaxLength(MAX_NAME)
  name: string;
}
