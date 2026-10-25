# Plan de pruebas v1

Cómo probamos RentSmart: qué se prueba en cada nivel, con qué herramienta, dónde viven los archivos, cómo se corren y qué corre el CI. Es la versión 1 del plan, de la historia F-10 ([#10](https://github.com/AlejandroMG/inf331-equipo-3/issues/10)), escrita el 24-10-2026.

La página [Estrategia de pruebas](https://github.com/AlejandroMG/inf331-equipo-3/wiki/Proyecto-Estrategia-de-pruebas) de la Wiki es la versión para el ramo, con los resultados de cada entrega. Este archivo es la referencia de trabajo del equipo: si cambia una herramienta, un comando o el CI, se actualiza en el mismo PR.

## Principios

- **Toda historia termina con tests** ([definición de terminado](flujo-de-trabajo.md#definición-de-terminado)): unitarias de la lógica de negocio, al menos un test de integración por endpoint nuevo y tests de los componentes del front con lógica.
- **Cada criterio de aceptación es al menos un caso de prueba.** Los nombres de los tests van en español y describen la regla, por ejemplo «no elimina un espacio con reservas y sugiere desactivarlo».
- **Pirámide de pruebas.** Muchas unitarias rápidas, integración contra una base de datos real para lo que toca la BD y pocos E2E con navegador, solo para los flujos críticos. Una regla se prueba en el nivel más bajo que la cubre; el E2E no repite lo que ya prueban los niveles de abajo.
- **Se busca como el usuario.** En el front y en Playwright los elementos se encuentran por rol y nombre accesible (`getByRole`, `getByText`), no por clases CSS ni `data-testid`. Si un test no encuentra un botón por su nombre, probablemente un lector de pantalla tampoco.
- **Todo corre en el CI.** Un PR no se mergea con el CI en rojo.

## Resumen por nivel

| Nivel | Herramienta | Dónde | Comando | Job del CI |
|---|---|---|---|---|
| Unitarias del back | Jest + `@nestjs/testing` | `rentsmart-back/src/**/*.spec.ts` | `npm test` · `npm run test:cov` | Backend (NestJS) |
| Integración de la API | Jest + Supertest + PostgreSQL de test | `rentsmart-back/test/*.e2e-spec.ts` | `npm run test:e2e` | Backend (NestJS) |
| Front: componentes y lógica | Vitest + React Testing Library + user-event + MSW | `rentsmart-front/src/**/*.test.ts(x)` | `npm test` | Frontend (React) |
| E2E con navegador | Playwright (Chromium) | `rentsmart-front/e2e/*.spec.ts` | `npm run test:e2e` | E2E (Playwright) |

Además, el CI corre la calidad estática antes de las pruebas: oxlint con tipos en el back, ESLint en el front y la compilación de TypeScript en ambos (`npm run build`).

## 1. Unitarias del back

- **Qué se prueba:** la lógica de los servicios con sus dependencias reemplazadas por dobles (`Test.createTestingModule` con Prisma o el almacenamiento simulados). Reglas de publicación, permisos (403 y 404), conflictos de estado o de horario (409), validaciones, transiciones de estado de la reserva, cálculo de montos en CLP, la ventana de cancelación de 24 horas ([P-14](decisiones.md#p-14--cancelación-gratis-hasta-24-horas-antes)), guards y utilidades de fechas.
- **Qué no:** controladores y DTOs (los ejercitan las pruebas de integración), consultas SQL reales y servicios externos (Stripe, Supabase, el proveedor de IA), que se simulan.
- **Dónde:** `*.spec.ts` al lado del archivo que prueban, dentro de `rentsmart-back/src/`. Configuración en `rentsmart-back/jest.config.ts`.
- **Cómo se corren:** `npm test` en `rentsmart-back`; `npm run test:cov` agrega la cobertura en `rentsmart-back/coverage/` (el informe HTML queda en `coverage/lcov-report/index.html`). Necesitan Node 24.9 o superior ([T-03](decisiones.md#t-03--nodejs-249-o-superior)).
- **Ojo:** `src/prisma/prisma.service.spec.ts` comprueba la conexión real a PostgreSQL, así que sin la base levantada esa prueba falla aunque el resto pase. En el CI la base de test existe y pasa.

## 2. Integración de la API

- **Qué se prueba:** cada endpoint con la app Nest completa y una base PostgreSQL real migrada. Se hacen peticiones HTTP con Supertest y se revisan el código de estado (400, 401, 403, 404, 409), la validación de los DTOs, los guards de JWT y de rol, la forma del JSON que recibe el front y los efectos en la base (por ejemplo, que dos reservas no se crucen).
- **Qué no:** la interfaz, ni servicios externos reales. Las fotos se guardan en una carpeta temporal con el almacenamiento local.
- **Dónde:** `rentsmart-back/test/*.e2e-spec.ts`, con utilidades en `rentsmart-back/test/utils/` (`create-test-app.ts`, `auth.ts`, `setup-env.ts`). Configuración en `rentsmart-back/test/jest-e2e.json`.
- **Datos:** cada archivo crea sus propios usuarios, tipos y regiones con un sufijo único y los borra al terminar, así que no dependen del seed ni chocan entre sí.
- **Base de test separada:** `setup-env.ts` reemplaza `DATABASE_URL` por `DATABASE_TEST_URL` (servicio `db-test` del `docker compose`, puerto 5433) y se niega a correr si falta. Nunca tocan la base de desarrollo.
- **Cómo se corren:**

  ```bash
  docker compose up -d db-test           # desde la raíz del repo
  cd rentsmart-back
  DATABASE_URL=postgresql://testuser:testpassword@localhost:5433/testdb npx prisma migrate deploy
  npm run test:e2e
  ```

## 3. Front: componentes y lógica

- **Qué se prueba:** las pantallas y componentes con lógica como los usa una persona (escribir, elegir, enviar, navegar con el teclado), los hooks, las utilidades de `src/lib/` y los handlers de MSW, que funcionan como contrato con la API mientras el endpoint real no existe. `src/test/a11y.test.tsx` pasa axe-core sobre las pantallas reales (WCAG 2.2 AA).
- **Qué no:** estilos y diseño (Vitest corre con `css: false` en jsdom), el aspecto a 375 px (se revisa a mano, según la definición de terminado) ni un navegador real, que es el trabajo de Playwright.
- **Dónde:** `*.test.ts(x)` dentro de `rentsmart-front/src/`. La configuración está en la sección `test` de `rentsmart-front/vite.config.ts`, que excluye `e2e/`, y en `src/test/setup.ts`.
- **API simulada:** los handlers de `src/mocks/` responden por defecto con el servidor de MSW para Node (`src/mocks/server.ts`) y cada test sobreescribe los que necesita. Una petición sin handler hace fallar el test (`onUnhandledRequest: 'error'`): nada sale a la red.
- **Cómo se corren:** `npm test` en `rentsmart-front` (`npm run test:watch` para el modo interactivo).

## 4. E2E con navegador (Playwright)

- **Qué se prueba hoy:** un smoke test (`e2e/smoke.spec.ts`) que abre la app en Chromium y comprueba que la página de inicio muestra el catálogo de los mocks (`src/mocks/catalog-data.ts`), que la paginación lleva a la segunda página y que una tarjeta abre el detalle del espacio. Confirma que el build de Vite, el enrutador y MSW funcionan juntos en un navegador real.
- **Qué no:** las reglas de negocio en detalle (ya están en los niveles de abajo) ni otros navegadores. Por ahora solo se usa Chromium; Firefox y WebKit se pueden sumar como proyectos de `playwright.config.ts` si el ramo lo pide.
- **Cómo funciona:** `rentsmart-front/playwright.config.ts` levanta Vite en el puerto 5180 con `VITE_USE_MOCKS=true` y `VITE_API_URL=http://localhost:5180`, así que MSW responde la API desde el service worker (`src/main.tsx`, `src/mocks/browser.ts`, `public/mockServiceWorker.js`). No necesita el back ni la base de datos. Usa un puerto propio para no reutilizar por error un `npm run dev` en 5173 conectado al back real. Fuera del CI reutiliza el servidor si ya está levantado en 5180.
- **Dónde:** `rentsmart-front/e2e/*.spec.ts`. Vitest no los toma y `tsc -b` los revisa con `tsconfig.node.json`.
- **Cómo se corren:**

  ```bash
  cd rentsmart-front
  npx playwright install chromium   # solo la primera vez
  npm run test:e2e
  npx playwright show-report        # informe HTML de la última ejecución
  ```

  Los informes quedan en `playwright-report/` y `test-results/`, que están en el `.gitignore`.

## Qué corre el CI

El workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) corre en cada push a `main` y `develop` y en cada pull request hacia `main`, `develop` o una rama `release/**`.

| Job | Pasos |
|---|---|
| **Backend (NestJS)** | Levanta PostgreSQL 17 como servicio (puerto 5433), genera el cliente de Prisma, aplica las migraciones, corre oxlint, las unitarias con cobertura (`npm run test:cov`), los tests de integración (`npm run test:e2e`) y el build. Publica la tabla de cobertura en el resumen del job y sube `rentsmart-back/coverage/` como artefacto `backend-coverage-report` (7 días). |
| **Frontend (React)** | ESLint, `npm test` (Vitest) y el build. |
| **E2E (Playwright)** | Instala Chromium con `npx playwright install --with-deps chromium` y corre `npm run test:e2e`. Si falla, sube `playwright-report/` y `test-results/` como artefacto `playwright-report` (7 días). |

Los nombres «Backend (NestJS)» y «Frontend (React)» son checks obligatorios del ruleset de `main`: no se cambian. «E2E (Playwright)» todavía no es obligatorio; conviene agregarlo al ruleset cuando lleve algunas semanas estable.

## Estado actual

Archivos de test en el repo al 24-10-2026, contados con `git ls-files` (son archivos, no casos de prueba):

| Nivel | Archivos |
|---|---|
| Unitarias del back (`rentsmart-back/src/**/*.spec.ts`) | 25 |
| Integración de la API (`rentsmart-back/test/*.e2e-spec.ts`) | 22 |
| Front (`rentsmart-front/src/**/*.test.ts(x)`) | 50 |
| E2E con navegador (`rentsmart-front/e2e/*.spec.ts`) | 1 |

**Cobertura del back.** La cobertura que mide el CI es la de las unitarias (`npm run test:cov` en el job Backend); los tests de integración todavía no suman a ese informe. El valor de cada ejecución se ve en el resumen del job Backend («Cobertura del Backend») y en el artefacto `backend-coverage-report`, que trae el informe HTML por archivo. En la Entrega 1 fue de 45,6 % de líneas ([Wiki](https://github.com/AlejandroMG/inf331-equipo-3/wiki/Proyecto-Estrategia-de-pruebas#resultados-entrega-1)). El front no mide cobertura todavía.

## Meta de cobertura

**Pendiente de [P-11](decisiones.md#p-11--meta-de-pruebas)** ([#78](https://github.com/AlejandroMG/inf331-equipo-3/issues/78)): el profesor todavía no responde si el ramo exige una cobertura mínima, ciertos tipos de prueba o informes. No se fija ninguna cifra hasta tener esa respuesta.

Mientras tanto rige la [definición de terminado](flujo-de-trabajo.md#definición-de-terminado): cada historia trae unitarias de su lógica de negocio, al menos un test de integración por endpoint nuevo, tests de los componentes del front con lógica y el CI en verde.

Cuando llegue la respuesta:

1. Se registra la decisión en P-11 (`docs/decisiones.md`) y se actualiza esta sección.
2. Si la meta es un porcentaje, se configura como umbral para que el CI falle por debajo de él (`coverageThreshold` en Jest; `test.coverage.thresholds` en Vitest, que necesita `@vitest/coverage-v8`).
3. Si la meta incluye la integración, se unen los informes de las unitarias y de los e2e del back en uno solo, como quedó planteado en la Wiki para la Entrega 2.

## Flujo completo con Playwright (QA-01, trabajo futuro)

[QA-01](https://github.com/AlejandroMG/inf331-equipo-3/issues/64) prueba el flujo completo en un navegador contra el back real. No está implementado; esta sección deja el diseño para cuando se tome.

- **Flujo:** registro → publicar un espacio → buscarlo en el catálogo → reservar → pagar con la tarjeta de prueba de Stripe (`4242 4242 4242 4242`) → ver la reserva `Confirmada`. El issue menciona «aceptar», pero con la reserva inmediata ([P-05](decisiones.md#p-05--reserva-inmediata)) el propietario no aprueba nada: en su lugar se comprueba que la validación automática deja la reserva en `Confirmada` y que el detalle privado de la dirección aparece solo entonces.
- **Cada integrante escribe su tramo:** A el registro y el inicio de sesión, B publicar y buscar, C reservar y pagar. Conviene un helper por tramo en `e2e/` (por ejemplo `registerUser`, `publishSpace`, `bookAndPay`) para que cada uno lo mantenga sin pisar el de otro.
- **Entorno:** un archivo o proyecto aparte de Playwright (por ejemplo `playwright.full.config.ts`) con `webServer` para dos procesos: el back con la base de test migrada y el front sin MSW, con `VITE_API_URL` apuntando al back. El smoke actual sigue igual, con mocks.
- **Datos:** como en la integración, cada ejecución crea su propia cuenta y su espacio con un sufijo único, y no depende del seed.
- **Pago:** la página de Stripe Checkout es externa. Hay que elegir entre recorrerla en modo test con la tarjeta de prueba, que es lo más realista pero depende de la red y de cambios de Stripe, o simular el webhook firmado con `STRIPE_WEBHOOK_SECRET` (o `stripe trigger`) y dejar Checkout para una prueba manual. Depende de PA-02 ([#46](https://github.com/AlejandroMG/inf331-equipo-3/issues/46)).
- **CI:** un job aparte con PostgreSQL como servicio y las claves de Stripe en modo test como secretos de GitHub. Como los secretos no llegan a los PR desde forks y la prueba es más lenta, puede correr en los push a `develop` y en los PR de `release/**`, además de a mano (`workflow_dispatch`).
- **A 375 px:** se puede sumar un proyecto de Playwright con un dispositivo móvil (`devices['Pixel 7']`, por ejemplo) para cubrir el punto de la definición de terminado sobre pantallas chicas.

## Cómo evoluciona

| Cuándo | Qué se agrega |
|---|---|
| Entrega 1 | Unitarias, integración con BD real, componentes con RTL y MSW, accesibilidad con axe y CI en cada PR |
| F-10 (este plan) | Plan de pruebas v1, Playwright con un smoke test en el CI y CI también en los PR hacia `release/**` |
| Al responder P-11 | Meta de cobertura con umbral en el CI |
| QA-01 | E2E del flujo completo contra el back real |
