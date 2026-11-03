import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { UPLOADS_PREFIX, uploadsDir } from './storage/storage.service';

const DEFAULT_FRONTEND_URL = 'http://localhost:5173';

/**
 * Configuración común de la API. Se usa en main.ts y en los tests e2e,
 * para que probar la API sea probar la misma que corre en producción.
 */
export function configureApp(app: INestApplication): void {
  const secureHeaders = helmet();
  const swaggerHeaders = helmet({ contentSecurityPolicy: false });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const isSwagger = request.path === '/docs' || request.path.startsWith('/docs/');
    (isSwagger ? swaggerHeaders : secureHeaders)(request, response, next);
  });
  // Todo REST bajo /api; Swagger queda aparte, en /docs.
  app.setGlobalPrefix('api');
  // El front corre en otro origen (otro puerto en local): sin CORS el navegador bloquea las peticiones.
  const frontendOrigin =
    app.get(ConfigService).get<string>('FRONTEND_URL') ?? DEFAULT_FRONTEND_URL;
  const corsOptions: CorsOptions = {
    origin: (origin, callback) =>
      callback(null, origin === frontendOrigin),
  };
  app.enableCors(corsOptions);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Con el almacenamiento local las fotos se sirven desde disco; con Supabase las sirve Supabase.
  if (process.env.STORAGE_DRIVER !== 'supabase') {
    (app as NestExpressApplication).useStaticAssets(uploadsDir(), {
      prefix: UPLOADS_PREFIX,
    });
  }
}

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('RentSmart API')
    .setDescription(
      'API REST de RentSmart: arriendo de espacios por hora o por día.',
    )
    .setVersion('1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}
