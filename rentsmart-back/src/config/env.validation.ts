import { plainToInstance, Type } from 'class-transformer';
import 'reflect-metadata';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsOptional()
  DATABASE_TEST_URL: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  PORT: number;

  // Origen del front permitido por CORS. Si no se define, se usa el de Vite en local.
  @IsString()
  @IsOptional()
  FRONTEND_URL: string;

  // Firma de los tokens de sesión. Obligatoria: sin ella cualquiera podría fabricar un token.
  @IsString()
  @MinLength(32, { message: 'JWT_SECRET debe tener al menos 32 caracteres' })
  JWT_SECRET: string;

  // Duración del token, por ejemplo "1d" o "8h". Si no se define, dura 1 día.
  @IsString()
  @IsOptional()
  @Matches(/^\d+[smhd]$/, {
    message: 'JWT_EXPIRES_IN debe ser un número seguido de s, m, h o d',
  })
  JWT_EXPIRES_IN: string;
}

function validate(config: Record<string, unknown>) {
  const instance = plainToInstance(EnvironmentVariables, config);
  const result = validateSync(instance);

  if (result.length > 0) {
    const errors = result
      .map(
        (error) =>
          `${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`,
      )
      .join('; ');
    throw new Error(`Fallaron las variables ${errors}`);
  }
  return instance;
}

export { EnvironmentVariables, validate };
