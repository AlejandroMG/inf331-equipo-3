# RentSmart

[![CI](https://github.com/AlejandroMG/inf331-equipo-3/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/AlejandroMG/inf331-equipo-3/actions/workflows/ci.yml?query=branch%3Adevelop)
[![CI en main](https://github.com/AlejandroMG/inf331-equipo-3/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/AlejandroMG/inf331-equipo-3/actions/workflows/ci.yml?query=branch%3Amain)

Aplicación web para arrendar espacios entre particulares (salas de reuniones, estudios, cocinas, canchas y otros) por hora o por día: publicación, búsqueda, reserva y pago en línea.

Proyecto de INF331 Pruebas de Software, Universidad Técnica Federico Santa María, semestre 2 de 2026. Equipo 3, tema 1.

## Enlaces

| | |
|---|---|
| Videos | [Entrega 1](https://youtu.be/QrpY-6-MbvQ) · [Entrega 2](https://youtu.be/YdUN9zQ58AY) · Entrega 3: se agrega al publicar el release `v3.0-entrega3` |
| Wiki (documentación de entregas) | [Inicio](https://github.com/AlejandroMG/inf331-equipo-3/wiki) · [Entrega 1](https://github.com/AlejandroMG/inf331-equipo-3/wiki/Entrega-1) · [Entrega 2](https://github.com/AlejandroMG/inf331-equipo-3/wiki/Entrega-2) · [Entrega 3](https://github.com/AlejandroMG/inf331-equipo-3/wiki/Entrega-3) |
| Releases | [`v1.0-entrega1`](https://github.com/AlejandroMG/inf331-equipo-3/releases/tag/v1.0-entrega1) · [`v2.0-entrega2`](https://github.com/AlejandroMG/inf331-equipo-3/releases/tag/v2.0-entrega2) · [Release notes de cada entrega](CHANGELOG.md) |
| CI/CD | [Ejecuciones de GitHub Actions](https://github.com/AlejandroMG/inf331-equipo-3/actions/workflows/ci.yml) · avisos en el canal de Discord del equipo |
| Entrega 3 (pruebas E2E/UI con Selenium) | [`docs/entrega-3.md`](docs/entrega-3.md) · [`e2e-selenium/`](e2e-selenium/README.md) |
| Backlog | [Issues y milestones](https://github.com/AlejandroMG/inf331-equipo-3/issues) |

## Integrantes

| Rol | Integrante | GitHub | Responsabilidad |
|---|---|---|---|
| A | Alejandro Fierro | [@AlejandroMG](https://github.com/AlejandroMG) | Cuentas, IA y administración |
| B | Renato Ramírez | [@xReNatS](https://github.com/xReNatS) | Espacios y catálogo |
| C | Gonzalo Gutierrez | [@gonzzza-lol](https://github.com/gonzzza-lol) | Reservas, pagos y CI |

Líder de equipo: Renato Ramírez ([@xReNatS](https://github.com/xReNatS)).

## Estado de la Entrega 3

**Funciona:**
- **Cuentas:** registro e inicio de sesión con roles, modo propietario, perfil editable y seguridad de la API (CU-01 a CU-06).
- **Espacios:** CRUD completo (publicar por pasos con fotos y horario semanal, listar, buscar con filtros, ver el detalle con galería, mapa y calendario de disponibilidad, editar y eliminar), con la descripción generada por IA como opción (ES-01 a ES-08, BU-01 a BU-08, IA-01, IA-02).
- **Reservas y pagos:** reservar sin cruces, cancelar, vencimientos, pago con Stripe Checkout en modo test, confirmación por webhook, confirmación automática de la reserva y reembolsos (RE-02 a RE-06, DI-02, PA-01 a PA-03).
- **Paneles:** propietario (mis espacios, reservas y métricas), arrendatario (mis reservas y pagos) y administración de espacios y tipos (PN-01 a PN-04, AD-02).
- **Calidad:** pruebas unitarias, de integración, de componentes y E2E/UI con Selenium y Playwright, todas dentro del pipeline de GitHub Actions, que además empaqueta el build y avisa el resultado en Discord.

**Todavía no:** administración de usuarios (AD-01), reseñas (RS-01 a RS-03) y despliegue público. La aplicación corre en local; el pipeline genera los paquetes listos para desplegar.

## Estructura

| Carpeta | Contenido | Stack |
|---|---|---|
| `rentsmart-back/` | API REST | NestJS 12, TypeScript, Jest, Supertest |
| `rentsmart-front/` | Aplicación web | React 19, Vite 8, Tailwind CSS 4 |

## Requisitos

- **Node.js 24.9 o superior.** NestJS 12 se distribuye solo como ES Modules, y Jest necesita Node 24.9+ para cargarlo; con versiones anteriores los tests del back no corren.
- npm 11 o superior.

## Cómo levantar el proyecto

1. Clona el repositorio y copia las variables de entorno:

   ```bash
   cp .env.example rentsmart-back/.env
   cp .env.example rentsmart-front/.env
   ```
2. Base de datos, desde la raíz del repo:

   ```bash
   docker compose up -d
   cd rentsmart-back
   npm install
   npx prisma migrate dev   # crear las tablas
   npx prisma generate      # generar el cliente de Prisma
   npm run seed             # carga datos de prueba
   ```

   Si ya tenías un `rentsmart-back/.env` de antes, revisa que tenga `JWT_SECRET` (mínimo 32 caracteres, como en `.env.example`): sin él la API no arranca.

   Usuarios de prueba (contraseña `Password123`): `admin@rentsmart.test`, `propietario@rentsmart.test` y `arrendatario@rentsmart.test`.
3. Backend (queda en http://localhost:3000):

   ```bash
   cd rentsmart-back
   npm install
   npm run start:dev
   ```

4. Frontend, en otra terminal (queda en http://localhost:5173):

   ```bash
   cd rentsmart-front
   npm install
   npm run dev
   ```

## Scripts útiles

| Dónde | Comando | Qué hace |
|---|---|---|
| back | `npm run start:dev` | API con recarga automática |
| back | `npm test` | Tests unitarios (Jest) |
| back | `npm run test:e2e` | Tests end-to-end de la API (Supertest) |
| back | `npm run test:cov` | Tests con reporte de cobertura |
| back | `npm run lint` | Lint con oxlint |
| front | `npm test` | Tests de componentes y lógica (Vitest + React Testing Library + MSW) |
| front | `npm run test:e2e` | Smoke test E2E en Chromium con Playwright, con la API simulada por MSW (la primera vez: `npx playwright install chromium`) |
| front | `npm run dev` | Servidor de desarrollo de Vite |
| front | `npm run build` | Build de producción en `dist/` |
| front | `npm run lint` | Lint con ESLint |
| e2e-selenium | `npm test` | Pruebas E2E/UI con Selenium en Chrome headless contra el stack real (ver [`e2e-selenium/README.md`](e2e-selenium/README.md)) |
| raíz | `docker compose up -d` | Levanta PostgreSQL de desarrollo (5432) y de test (5433) |
| back | `npx prisma migrate dev` | Aplica migraciones y regenera el cliente de Prisma |
| back | `npm run seed` | Carga datos de prueba (se puede repetir) |
| back | `npx prisma studio` | Explorador visual de la base de datos |

## Pruebas

| Nivel | Herramienta | Comando | Dónde |
|---|---|---|---|
| Unitarias del back | Jest | `npm test` | `rentsmart-back/src/**/*.spec.ts` |
| Integración de la API | Jest + Supertest + PostgreSQL de test | `npm run test:e2e` | `rentsmart-back/test/*.e2e-spec.ts` |
| Front (componentes y lógica) | Vitest + React Testing Library + MSW | `npm test` | `rentsmart-front/src/**/*.test.ts(x)` |
| E2E con navegador (smoke) | Playwright (Chromium) + MSW | `npm run test:e2e` | `rentsmart-front/e2e/*.spec.ts` |
| E2E/UI del stack real (Entrega 3) | Selenium WebDriver + Mocha (Chrome headless) | `npm test` en `e2e-selenium` | `e2e-selenium/test/*.test.js` |

Los tests de integración usan la base de test del `docker compose` (puerto 5433) y necesitan `DATABASE_TEST_URL` en `rentsmart-back/.env`. Antes de la primera ejecución hay que migrarla:

```bash
cd rentsmart-back
DATABASE_URL=postgresql://testuser:testpassword@localhost:5433/testdb npx prisma migrate deploy
npm run test:e2e
```

**Resultados de la Entrega 3:** 2198 pruebas en verde en el CI (784 unitarias y 612 de integración del back, 774 del front, 3 de Playwright y 25 E2E/UI de Selenium). Cobertura de líneas de las unitarias del back: 62,1 %.

| Entrega | Pruebas | Cobertura de líneas del back |
|---|---|---|
| Entrega 1 | 1438 | 45,6 % |
| Entrega 2 | 1961 | 57 % |
| Entrega 3 | 2198 | 62,1 % |

El CI (`.github/workflows/ci.yml`) corre lint, tests unitarios con cobertura, tests de integración y build del back y del front, el smoke test de Playwright y las 25 pruebas E2E/UI con Selenium contra el stack real (PostgreSQL, API y front), en cada pull request. Las pruebas de Selenium, su ejecución y su evidencia se explican en [`docs/entrega-3.md`](docs/entrega-3.md). El detalle por nivel está en el [plan de pruebas](docs/plan-de-pruebas.md) y la estrategia para el ramo en la [Wiki](https://github.com/AlejandroMG/inf331-equipo-3/wiki/Proyecto-Estrategia-de-pruebas).

## Documentación

- [`AGENTS.md`](AGENTS.md): contexto y reglas para agentes de IA (y para personas).
- [`docs/`](docs/README.md): producto, arquitectura, decisiones, plan y flujo de trabajo.
- [`docs/memory.md`](docs/memory.md): bitácora obligatoria de sesiones de trabajo.

## Forma de trabajo

- El backlog vive en los [issues del repositorio](https://github.com/AlejandroMG/inf331-equipo-3/issues), con milestones por sprint y etiquetas por responsable (A, B, C), épica y prioridad.
- GitFlow: una rama por historia, `feature/<ID>-descripcion-corta` (por ejemplo `feature/RE-02-reservar-espacio`), que sale de `develop` y vuelve a `develop` por pull request. `main` solo recibe releases (`release/vX.0-entregaN`) con su tag.
- **Los commits son manuales**: ningún agente de IA commitea sin preguntar.
- Cada sesión de trabajo se registra en `docs/memory.md` con la plantilla.
- Todo cambio entra por pull request, con CI verde y la aprobación de un compañero. Detalle en [`docs/flujo-de-trabajo.md`](docs/flujo-de-trabajo.md).

## Contribuir y contacto

- Cómo contribuir (ramas, commits, pull requests y definición de terminado): [`CONTRIBUTING.md`](CONTRIBUTING.md).
- Dudas o problemas: abre un [issue](https://github.com/AlejandroMG/inf331-equipo-3/issues) o menciona al responsable del área (tabla de integrantes).

## Licencia

[MIT](LICENSE).
