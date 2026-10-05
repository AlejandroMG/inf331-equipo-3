import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './app.setup';

async function bootstrap() {
  // rawBody: Stripe necesita el cuerpo sin parsear para verificar la firma del webhook.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configureApp(app);
  setupSwagger(app);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
