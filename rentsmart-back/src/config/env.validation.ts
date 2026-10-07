import { plainToInstance, Type } from 'class-transformer';
import 'reflect-metadata';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
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

  /** Dónde se guardan las fotos: disco local (por defecto) o Supabase Storage. */
  @IsOptional()
  @IsIn(['local', 'supabase'])
  STORAGE_DRIVER: 'local' | 'supabase';

  /** Carpeta de las fotos con STORAGE_DRIVER=local (por defecto ./uploads). */
  @IsOptional()
  @IsString()
  UPLOADS_DIR: string;

  // Con STORAGE_DRIVER=supabase las tres son obligatorias.
  @ValidateIf((env: EnvironmentVariables) => env.STORAGE_DRIVER === 'supabase')
  @IsString()
  @IsNotEmpty()
  SUPABASE_URL: string;

  @ValidateIf((env: EnvironmentVariables) => env.STORAGE_DRIVER === 'supabase')
  @IsString()
  @IsNotEmpty()
  SUPABASE_SERVICE_ROLE_KEY: string;

  @ValidateIf((env: EnvironmentVariables) => env.STORAGE_DRIVER === 'supabase')
  @IsString()
  @IsNotEmpty()
  SUPABASE_BUCKET: string;

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
