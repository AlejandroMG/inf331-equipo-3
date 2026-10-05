import 'dotenv/config';

// Los e2e usan la base de test (puerto 5433), nunca la de desarrollo. Se ejecuta antes de importar AppModule,
// porque ConfigModule valida DATABASE_URL al cargarse.
const testUrl = process.env.DATABASE_TEST_URL;
if (!testUrl) {
  throw new Error(
    'Falta DATABASE_TEST_URL: los tests e2e solo pueden correr contra la base de test.',
  );
}
process.env.DATABASE_URL = testUrl;
