import { plainToInstance, Type } from 'class-transformer';
import 'reflect-metadata';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
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
