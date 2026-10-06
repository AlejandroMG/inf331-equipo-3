import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { UPLOADS_PREFIX, uploadsDir } from './storage/storage.service';

const DEFAULT_FRONTEND_URL = 'http://localhost:5173';

/**
 * Configuración común de la API. Se usa en main.ts y en los tests e2e,
 * para que probar la API sea probar la misma que corre en producción.
 */
export function configureApp(app: INestApplication): void {
  // Todo REST bajo /api; Swagger queda aparte, en /docs.
  app.setGlobalPrefix('api');
  // El front corre en otro origen (otro puerto en local): sin CORS el navegador bloquea las peticiones.
  app.enableCors({
    origin:
      app.get(ConfigService).get<string>('FRONTEND_URL') ??
      DEFAULT_FRONTEND_URL,
  });
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
