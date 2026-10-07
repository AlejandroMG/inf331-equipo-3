import 'dotenv/config';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Los e2e usan la base de test (puerto 5433), nunca la de desarrollo. Se ejecuta antes de importar AppModule,
// porque ConfigModule valida DATABASE_URL al cargarse.
const testUrl = process.env.DATABASE_TEST_URL;
if (!testUrl) {
  throw new Error(
    'Falta DATABASE_TEST_URL: los tests e2e solo pueden correr contra la base de test.',
  );
}
process.env.DATABASE_URL = testUrl;

// Las fotos de los e2e se guardan en una carpeta temporal, nunca en ./uploads, y siempre con el almacenamiento local.
process.env.STORAGE_DRIVER = 'local';
process.env.UPLOADS_DIR = join(tmpdir(), 'rentsmart-e2e-uploads');
