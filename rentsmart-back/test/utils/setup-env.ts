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

// Sin el barrido periódico de vencimientos (RE-06): no deja temporizadores abiertos en Jest ni cambia los datos de
// otras pruebas. test/booking-expiry.e2e-spec.ts llama al servicio directamente, con su propio reloj.
process.env.BOOKING_SWEEP_ENABLED = 'false';

// Ningún e2e llama a Stripe (PA-01): sin la clave, CheckoutModule usa el checkout provisorio. Se dejan en cadena
// vacía, no se borran: ConfigModule.forRoot vuelve a leer rentsmart-back/.env y copia a process.env cada variable que
// no esté definida (`!(key in process.env)`), así que con `delete` volvería una clave real del .env. Vacías, la
// validación las toma como ausentes y createStripeClient devuelve null (lo comprueba test/stripe-disabled.e2e-spec.ts).
// Los e2e que necesitan una sesión de Stripe sobrescriben el gateway con jest.spyOn.
process.env.STRIPE_SECRET_KEY = '';
process.env.STRIPE_WEBHOOK_SECRET = '';
