import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'arrendatario@rentsmart.test' })
  // Igual que en el registro: el email se compara en minúsculas.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Ingresa un email válido.' })
  email: string;

  @ApiProperty({ example: 'Password123' })
  // Sin largo mínimo: al iniciar sesión no se revelan las reglas de la contraseña.
  @IsString({ message: 'La contraseña es obligatoria.' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  password: string;
}
