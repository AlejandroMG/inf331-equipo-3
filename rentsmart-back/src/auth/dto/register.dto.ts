import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterDto {
  // Se guarda en minúsculas para que "Ana@Mail.com" y "ana@mail.com" sean la misma cuenta.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @ApiProperty({ example: 'ana@rentsmart.test' })
  @IsEmail({}, { message: 'Ingresa un email válido.' })
  email: string;

  @ApiProperty({ example: 'Password123', minLength: 8, maxLength: 72 })
  @IsString({ message: 'La contraseña es obligatoria.' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  // bcrypt solo considera los primeros 72 bytes.
  @MaxLength(72, { message: 'La contraseña puede tener hasta 72 caracteres.' })
  password: string;

  @ApiProperty({ example: 'Ana Pérez', maxLength: 100 })
  @Transform(trim)
  @IsString({ message: 'El nombre es obligatorio.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @MaxLength(100, { message: 'El nombre puede tener hasta 100 caracteres.' })
  name: string;
}
