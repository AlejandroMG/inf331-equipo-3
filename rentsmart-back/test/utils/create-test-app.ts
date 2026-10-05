import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { configureApp, setupSwagger } from '../../src/app.setup';

/** Crea la API con la misma configuración que main.ts (prefijo /api, validación y Swagger). */
export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  setupSwagger(app);
  await app.init();
  return app;
}
