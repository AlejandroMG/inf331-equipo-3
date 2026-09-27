# RentSmart

Aplicación web para arrendar espacios entre particulares (salas de reuniones, estudios, cocinas, canchas y otros) por hora o por día: publicación, búsqueda, reserva y pago en línea.

Proyecto del ramo INF331, equipo 3.

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
   npx prisma migrate dev   # crear las tablas y generar el cliente de Prisma
   npm run seed             # carga datos de prueba
   ```

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
| front | `npm run dev` | Servidor de desarrollo de Vite |
| front | `npm run build` | Build de producción en `dist/` |
| front | `npm run lint` | Lint con ESLint |
| raíz | `docker compose up -d` | Levanta PostgreSQL de desarrollo (5432) y de test (5433) |
| back | `npx prisma migrate dev` | Aplica migraciones y regenera el cliente de Prisma |
| back | `npm run seed` | Carga datos de prueba (se puede repetir) |
| back | `npx prisma studio` | Explorador visual de la base de datos |

## Documentación

- [`AGENTS.md`](AGENTS.md): contexto y reglas para agentes de IA (y para personas).
- [`docs/`](docs/README.md): producto, arquitectura, decisiones, plan y flujo de trabajo.
- [`docs/memory.md`](docs/memory.md): bitácora obligatoria de sesiones de trabajo.

## Forma de trabajo

- El backlog vive en los [issues del repositorio](https://github.com/AlejandroMG/inf331-equipo-3/issues), con milestones por sprint y etiquetas por responsable (A, B, C), épica y prioridad.
- Una rama por historia: `feat/<ID>-descripcion-corta` (por ejemplo `feat/RE-02-reservar-espacio`).
- **Los commits son manuales**: ningún agente de IA commitea sin preguntar.
- Cada sesión de trabajo se registra en `docs/memory.md` con la plantilla.
- Todo cambio entra a `main` por pull request, con CI verde y la aprobación de un compañero. Detalle en [`docs/flujo-de-trabajo.md`](docs/flujo-de-trabajo.md).
