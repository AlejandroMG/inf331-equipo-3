import { INestApplication } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { configureApp, setupSwagger } from '../../src/app.setup';

/**
 * Crea la API con la misma configuración que main.ts (prefijo /api, validación, Swagger y el cuerpo sin interpretar del webhook).
 * `customize`, opcional, permite sobrescribir providers antes de compilar (por ejemplo, un doble del cliente de Stripe).
 */
export async function createTestApp(
  customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
): Promise<INestApplication<App>> {
  const moduleRef = await customize(
    Test.createTestingModule({
      imports: [AppModule],
    }),
  ).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({
    rawBody: true,
  });
  configureApp(app);
  setupSwagger(app);
  await app.init();
  return app;
}
