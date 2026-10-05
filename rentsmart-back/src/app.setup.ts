import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Configuración común de la API. Se usa en main.ts y en los tests e2e,
 * para que probar la API sea probar la misma que corre en producción.
 */
export function configureApp(app: INestApplication): void {
  // Todo REST bajo /api; Swagger queda aparte, en /docs.
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('RentSmart API')
    .setDescription('API REST de RentSmart: arriendo de espacios por hora o por día.')
    .setVersion('1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}
