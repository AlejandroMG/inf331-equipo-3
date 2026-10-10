# RentSmart

Aplicación web para arrendar espacios entre particulares (salas de reuniones, estudios, cocinas, canchas y otros) por hora o por día: publicación, búsqueda, reserva y pago en línea.

Proyecto de INF331 Pruebas de Software, Universidad Técnica Federico Santa María, semestre 2 de 2026. Equipo 3, tema 1.

## Enlaces

| | |
|---|---|
| Video Entrega 1 | [Ver en YouTube](https://youtu.be/QrpY-6-MbvQ) |
| Wiki (documentación de entregas) | [github.com/AlejandroMG/inf331-equipo-3/wiki](https://github.com/AlejandroMG/inf331-equipo-3/wiki) |
| Release Entrega 1 | [`v1.0-entrega1`](https://github.com/AlejandroMG/inf331-equipo-3/releases/tag/v1.0-entrega1) · [Release notes](CHANGELOG.md) |
| Backlog | [Issues y milestones](https://github.com/AlejandroMG/inf331-equipo-3/issues) |

## Integrantes

| Rol | Integrante | GitHub | Responsabilidad |
|---|---|---|---|
| A | Alejandro Fierro | [@AlejandroMG](https://github.com/AlejandroMG) | Cuentas, IA y administración |
| B | Renato Ramírez | [@xReNatS](https://github.com/xReNatS) | Espacios y catálogo |
| C | Gonzalo Gutierrez | [@gonzzza-lol](https://github.com/gonzzza-lol) | Reservas, pagos y CI |

Líder de equipo: Renato Ramírez ([@xReNatS](https://github.com/xReNatS)).

## Estado de la Entrega 1

**Funciona:** registro e inicio de sesión con roles; CRUD de espacios (publicar por pasos con fotos y horario semanal, listar, buscar con filtros, ver el detalle con galería y mapa, editar y eliminar); panel "Mis espacios" del propietario; favoritos; administración de espacios y de tipos de espacio.

**Todavía no:** reservar y pagar (Entrega 2), IA, administración de usuarios y despliegue público. La aplicación corre en local.

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
| front | `npm run dev` | Servidor de desarrollo de Vite |
| front | `npm run build` | Build de producción en `dist/` |
| front | `npm run lint` | Lint con ESLint |
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

Los tests de integración usan la base de test del `docker compose` (puerto 5433) y necesitan `DATABASE_TEST_URL` en `rentsmart-back/.env`. Antes de la primera ejecución hay que migrarla:

```bash
cd rentsmart-back
DATABASE_URL=postgresql://testuser:testpassword@localhost:5433/testdb npx prisma migrate deploy
npm run test:e2e
```

**Resultados de la Entrega 1:** 1438 pruebas en verde (343 unitarias y 454 de integración del back, 641 del front). Cobertura de líneas de las unitarias del back: 45,6 %.

El CI (`.github/workflows/ci.yml`) corre lint, tests unitarios con cobertura, tests de integración y build del back y del front en cada pull request. La estrategia completa está en la [Wiki](https://github.com/AlejandroMG/inf331-equipo-3/wiki/Proyecto-Estrategia-de-pruebas).

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
