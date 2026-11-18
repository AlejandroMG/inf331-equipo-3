# Pruebas E2E/UI con Selenium

Pruebas de interfaz de RentSmart con **Selenium WebDriver** (JavaScript) y **Mocha**, para la Entrega 3. Abren la aplicación en Chrome y recorren los flujos críticos como lo haría una persona, contra el stack real: PostgreSQL con el seed, la API de NestJS y el front compilado. No usan mocks.

El documento completo de la entrega está en [`docs/entrega-3.md`](../docs/entrega-3.md).

## Requisitos

- Node.js 24.9 o superior (el mismo del resto del repo).
- Google Chrome instalado. Selenium Manager descarga solo el `chromedriver` que corresponde.
- Docker, o una PostgreSQL 17 propia, para la base de datos.

## Variables de entorno

| Variable | Por defecto | Para qué |
|---|---|---|
| `BASE_URL` | `http://localhost:4173` | Dónde corre el front. Nada de las pruebas apunta a un host fijo |
| `API_URL` | igual a `BASE_URL` | Base de la API para preparar datos. `vite preview` reenvía `/api` al back, por eso suele coincidir |
| `HEADLESS` | `true` | `false` abre el navegador para depurar en local |
| `WAIT_MS` | `10000` | Espera máxima de un elemento, en milisegundos |

## Cómo correrlas en local

Desde la raíz del repo. Usa un puerto de base de datos libre (aquí 5434).

```bash
# 1. Base de datos
docker run -d --name rentsmart-e2e-db -e POSTGRES_USER=e2e -e POSTGRES_PASSWORD=e2e -e POSTGRES_DB=e2edb -p 5434:5432 postgres:17

# 2. Back: migraciones, seed, build y arranque (otra terminal)
cd rentsmart-back
export DATABASE_URL=postgresql://e2e:e2e@localhost:5434/e2edb
export JWT_SECRET=una-cadena-larga-de-al-menos-32-caracteres
export FRONTEND_URL=http://localhost:4173 BOOKING_SWEEP_ENABLED=false
npx prisma migrate deploy && npm run seed && npm run build
node dist/main.js

# 3. Front compilado, con la API por el mismo origen (otra terminal)
cd rentsmart-front
VITE_API_URL=http://localhost:4173 npm run build
npx vite preview --port 4173 --strictPort

# 4. Pruebas
cd e2e-selenium
npm install
npm test
```

Para ver el navegador: `HEADLESS=false npm test`. Una sola prueba o archivo: `npx mocha test/catalog.test.js` o `npx mocha --grep CAT-02`.

> **Límite de login.** La API permite 10 intentos de login por IP cada 15 minutos (CU-05). Una corrida completa usa 7. Para repetir la suite más de una vez seguida, reinicia la API (el contador está en memoria) o espera 15 minutos. El CI no lo sufre porque cada ejecución parte de una API nueva.

## Qué hay

| Archivo | Pruebas | Qué cubre |
|---|---|---|
| `test/catalog.test.js` | CAT-01 a CAT-07 | Catálogo, búsqueda, sin resultados, filtro por tipo, orden por precio, detalle, página 404 |
| `test/auth.test.js` | AUT-01 a AUT-08 | Registro (validaciones, éxito, email repetido), login (error, éxito, logout), ruta protegida, permisos de administrador |
| `test/owner.test.js` | OWN-01 a OWN-03 | Panel «Mis espacios», activar y desactivar, eliminar un borrador |
| `test/booking.test.js` | BOK-01 a BOK-03 | Reservar sin sesión, reservar con sesión y ver la reserva pendiente, reserva ajena sin sesión |
| `test/account.test.js` | FAV-01, PRF-01 | Favoritos y edición del perfil |

Hay 23 pruebas. La explicación de cada una está en [`docs/entrega-3.md`](../docs/entrega-3.md#set-de-pruebas).

## Cómo están escritas

- **Un archivo por dominio, un Chrome por archivo.** `lib/session.js` abre el navegador una vez y borra la sesión (`localStorage`) antes de cada prueba.
- **Cada prueba prepara sus datos.** Las cuentas nuevas llevan un email único y las reservas eligen un horario al azar, así que no dependen del orden ni de corridas anteriores. Los usuarios del seed (`arrendatario@`, `propietario@`, `admin@rentsmart.test`, contraseña `Password123`) solo se leen o se dejan como estaban.
- **Selectores estables.** Se busca por lo que ve la persona: el `name` de un campo, el texto de un botón o encabezado y los `aria-label`. No por clases CSS.
- **Evidencia al fallar.** Si una prueba falla, `lib/hooks.js` guarda en `screenshots/` el screenshot, el HTML de la página y el log de la consola del navegador.
- **Reportes.** `reports/index.html` (Mochawesome, abrir en el navegador), `reports/index.json` y `reports/junit.xml`. `screenshots/` y `reports/` están en el `.gitignore`.
