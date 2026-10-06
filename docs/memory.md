# Bitácora de sesiones

Registro de cada sesión de trabajo en RentSmart. Sirve para que los tres integrantes, y los agentes de IA que usen, retomen el trabajo de otro sin perder el razonamiento.

## Reglas

1. **Una entrada por sesión de trabajo**, escrita por quien trabajó (o por su agente, revisada por esa persona), antes de proponer el commit.
2. **Siempre con la plantilla de abajo**, completa y en el mismo orden. Si una sección no aplica, escribe "No aplica" en vez de borrarla.
3. **Explica el porqué.** "Agregué un índice" no basta; "agregué un índice en `Booking(spaceId, startAt)` porque la consulta de disponibilidad hacía un escaneo completo" sí.
4. **Agrega tu entrada al final del archivo** (orden cronológico). Si hay un conflicto de merge aquí, conserva ambas entradas.
5. No edites entradas de otros. Si algo quedó mal, agrega una entrada nueva que lo corrija.
6. Si la sesión tomó una decisión de producto o de arquitectura, además regístrala en [`decisiones.md`](decisiones.md) y enlázala.

## Plantilla

Copia desde `### AAAA-MM-DD` hasta la línea `---` final:

```markdown
### AAAA-MM-DD · <Rol> (<usuario de GitHub>) · <título corto de la sesión>

**Issues:** #N, #M
**Rama / PR:** `feat/XX-00-descripcion` · PR #N (o "sin PR todavía")
**Duración aproximada:** 2 h
**Herramientas:** manual | Claude Code | Copilot | otra

#### Objetivo
Qué se buscaba lograr en esta sesión, en una o dos frases.

#### Qué se hizo
- Cambio concreto 1.
- Cambio concreto 2.

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| … | … | … |

#### Archivos principales
- `ruta/al/archivo.ts`: qué cambió.

#### Cómo probarlo
Comandos o pasos para verificar que funciona (tests que corren, URL, datos del seed a usar).

#### Estado de verificación
- Build: ✅ / ❌ / no aplica
- Lint: ✅ / ❌ / no aplica
- Tests: ✅ / ❌ (cuáles fallan y por qué) / no aplica

#### Pendientes y bloqueos
- Lo que quedó a medias, con el issue correspondiente.
- Lo que bloquea a otro integrante, o lo que me bloquea.

#### Para el resto del equipo
Lo que otro integrante o agente necesita saber antes de tocar esta parte: supuestos, trampas, contratos que cambiaron, variables nuevas.

---
```

## Entradas

### 2026-09-25 · B (xReNatS) · Backlog, decisiones iniciales y documentación base

**Issues:** #1 (F-01), #2 (F-02), #68–#78 (P-01 a P-11)
**Rama / PR:** `docs/F-01-F-02-base-y-decisiones` · PR #85
**Duración aproximada:** 3 h
**Herramientas:** Claude Code

#### Objetivo
Armar el backlog del proyecto para tres personas trabajando en paralelo, cargarlo en GitHub, resolver las decisiones que bloqueaban el inicio y dejar la documentación base del repo.

#### Qué se hizo
- Backlog de 67 historias y 17 decisiones cargado como issues (#1–#84), con etiquetas por responsable, prioridad y épica, y asignados: A @AlejandroMG, B @xReNatS, C @gonzzza-lol.
- Replanificación a dos sprints por la entrega del 9 de octubre: milestones `Sprint 1` (25 sep – 2 oct), `Sprint 2` (3 – 9 oct), `Post 9 de octubre` y `Extras`.
- Decisiones P-01 a P-10 tomadas y cerradas en GitHub; P-11 queda en espera del profesor.
- Arreglos de la estructura base (F-01): import faltante de `@tailwindcss/vite` en `vite.config.js`, se quitó `@nestjs/observe` (credenciales de ejemplo), README y `.env.example` completos, `.env` agregado a los `.gitignore`.
- Carpeta `docs/` con producto, arquitectura, decisiones, plan, flujo de trabajo y esta bitácora; `AGENTS.md` en la raíz y `CLAUDE.md` que lo importa.

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| Reserva inmediata con Pendiente → Pagada → Confirmada (P-05, P-06) | Solicitud con aprobación del propietario | Menos espera para el arrendatario y se mantienen los estados del enunciado; la validación posterior al pago diferencia Pagada de Confirmada |
| Retención de 30 min en Pendiente | 15 min | Es el mínimo que permite Stripe para expirar una Checkout Session, así la retención y la sesión vencen juntas |
| MVP en dos sprints; el resto a "Post 9 de octubre" | Mantener cuatro sprints | La entrega es el 9 de octubre y no sabemos si es la final |
| Dominios verticales por integrante (T-01) | Repartir por capas (back/front) | Menos esperas y menos conflictos de merge |
| Quitar `@nestjs/observe` (T-02) | Parametrizarlo con variables de entorno | No se necesita y traía credenciales de ejemplo |
| PN-03 (panel del arrendatario) pasa de C a A | Dejarlo en C | C quedaba con 21 puntos en el Sprint 2 |

#### Archivos principales
- `rentsmart-front/vite.config.js`: import de `@tailwindcss/vite`.
- `rentsmart-back/src/app.module.ts`, `src/main.ts`, `package.json`, `package-lock.json`: sin `@nestjs/observe`.
- `README.md`, `.env.example`, `.gitignore`, `rentsmart-front/.gitignore`.
- `AGENTS.md`, `CLAUDE.md`, `docs/*`.

#### Cómo probarlo
- `cd rentsmart-front && npm install && npm run build && npm run lint`
- `cd rentsmart-back && npm install && npm run build`

#### Estado de verificación
- Build: ✅ front y back
- Lint: ✅ front; back no se corrió
- Tests: ❌ el back falla con Node 22.16 ("Must use import to load ES Module"). No lo causan estos cambios: NestJS 12 es solo ESM y Jest necesita Node 24.9+ (T-03). Hay que volver a correrlos con Node 24.9+.

#### Pendientes y bloqueos
- Revisión y merge del PR #85 (revisa @gonzzza-lol según la rotación); al mergear se cierran #1 y #2.
- Decidir P-12, P-13, P-15 y P-17 antes del 3 de octubre: las necesita el Sprint 2.
- Preguntar al profesor P-11 (meta de pruebas) y si el 9 de octubre es la entrega final.
- F-11: crear el tablero de GitHub Projects.

#### Para el resto del equipo
- Instalen Node.js 24.9 o superior antes de correr los tests del back.
- A (@AlejandroMG) parte con F-03/F-04: todos dependen del schema de Prisma. El modelo borrador está en `docs/arquitectura.md`.
- La restricción de exclusión contra reservas cruzadas va en SQL dentro de una migración (ver `docs/arquitectura.md`), no en el schema de Prisma.

---

### 2026-09-29 · C (gonzzza-lol) · CI en GitHub Actions y main protegida (F-06)

**Issues:** #6 (F-06)
**Rama / PR:** `feat/F-06-ci-github-actions` · sin PR todavía
**Duración aproximada:** 45 min
**Herramientas:** Antigravity

#### Objetivo
Implementar el pipeline de Integración Continua en GitHub Actions para que cada PR a `main` ejecute lint, tests con cobertura y build de back y front, y dejar instrucciones para que el administrador active la protección de `main`.

#### Qué se hizo
- Se creó `.github/workflows/ci.yml` con dos jobs paralelos:
  - **Backend (NestJS):** `npm ci` → `lint` (oxlint) → `test:cov` (Jest con cobertura) → publicar tabla de cobertura en el resumen del workflow → subir artefacto `backend-coverage-report` → `build`.
  - **Frontend (React):** `npm ci` → `lint` (ESLint) → `npm test --if-present` (compatible con F-08 cuando lo implemente B) → `build`.
- Se usa Node.js 24 en ambos jobs (decisión T-03).
- Se configura `concurrency` para cancelar ejecuciones anteriores ante nuevos pushes en la misma rama.
### 2026-09-29 · C (gonzzza-lol) · Plantilla de Pull Request y convenciones de Git (F-11)

**Issues:** #11 (F-11)
**Rama / PR:** `feat/F-11-plantilla-pr-y-convenciones-git` · sin PR todavía
**Duración aproximada:** 30 min
**Herramientas:** Antigravity

#### Objetivo
Implementar la plantilla oficial de Pull Request para el repositorio y formalizar las convenciones de Git y ramas según lo especificado en la historia F-11.

#### Qué se hizo
- Se creó `.github/pull_request_template.md` alineado con `docs/flujo-de-trabajo.md`, incluyendo secciones para descripción del cambio (`Closes #N`), pasos de prueba y el checklist completo de la definición de terminado (tests, build/lint, Swagger, variables de entorno, bitácora de sesión y alerta de cambios en `schema.prisma`).
- Se verificaron las convenciones de ramas (`feat/<ID>-descripcion-corta`) y commits convencionales `<tipo>(<ámbito>): <ID> <descripción en español>`.

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| `npm test --if-present` en el front | Fallar si no hay script `test` | F-08 (Vitest) aún no está implementada por B; así el CI no bloquea el Sprint 1 y adopta las pruebas en cuanto B las agregue |
| Publicar cobertura en `$GITHUB_STEP_SUMMARY` | PR comment vía API | No requiere permisos extra; el resumen queda siempre accesible en la pestaña Actions del PR |
| Artefacto de cobertura con retención 7 días | Publicar en Codecov u otro servicio | Sin dependencias externas ni secretos adicionales en esta etapa |
| Protección de `main` por instrucción al admin | Configurarla por API con token de administrador | La cuenta activa no tiene permisos `admin` sobre el repositorio; se delega a @AlejandroMG |

#### Archivos principales
- `.github/workflows/ci.yml`: pipeline de CI (nuevo).
- `docs/memory.md`: registro de esta sesión.

#### Cómo probarlo
1. Abrir el PR en GitHub: las ejecuciones deben aparecer en la pestaña **Actions**.
2. Verificar que los jobs `Backend (NestJS)` y `Frontend (React)` terminan en ✅.
3. En la pestaña **Summary** del job de backend, ver la tabla de cobertura.
4. Revisar el artefacto `backend-coverage-report` adjunto a la ejecución.

#### Estado de verificación
- Build: no aplica (solo configuración YAML; se validará cuando GitHub Actions ejecute el workflow)
| Plantilla de PR en `.github/pull_request_template.md` | Mantener solo el texto explicativo en `flujo-de-trabajo.md` | GitHub carga automáticamente este archivo al abrir un PR, asegurando que ningún desarrollador omita la definición de terminado ni el enlace al issue |

#### Archivos principales
- `.github/pull_request_template.md`: plantilla de Pull Request con checklist de Definition of Done.
- `docs/memory.md`: registro de esta sesión.

#### Cómo probarlo
- Al abrir un nuevo Pull Request en GitHub o previsualizar `.github/pull_request_template.md`, se debe cargar automáticamente la estructura con el checklist de definición de terminado.

#### Estado de verificación
- Build: no aplica (solo configuración y markdown)
- Lint: no aplica
- Tests: no aplica

#### Pendientes y bloqueos
- **@AlejandroMG debe activar Branch Protection en `main`** tras el merge del PR:
  - Settings → Branches → Add rule → Pattern: `main`.
  - Activar: *Require a pull request before merging*, *Require 1 approval*, *Require status checks to pass*: `Backend (NestJS)` y `Frontend (React)`.
- El script `test` del front se ejecutará vacío hasta que F-08 sea implementada por B (@xReNatS).

#### Para el resto del equipo
- A partir de este PR, cada PR hacia `main` activará el CI automáticamente.
- El reporte de cobertura del back aparece en la pestaña "Summary" de cada ejecución en GitHub Actions y como artefacto descargable.
- El CI usa Node 24 (T-03): no instalen `node_modules` con Node 22 en el runner.
- Crear el PR para F-11 y solicitar revisión a A (@AlejandroMG) según la rotación de revisión.

#### Para el resto del equipo
- A partir de este cambio, cada nuevo PR creado en GitHub prellenará la plantilla con la checklist obligatoria de definición de terminado.

---

### 2026-09-26 · A (AlejandroMG) · F-04 PostgreSQL en Docker y validación de variables de entorno

**Issues:** #4 (F-04)
**Rama / PR:** `feat/F-04-postgres-docker` · PR #86
**Duración aproximada:** 2 h
**Herramientas:** manual, con Claude Code como guía (explicó cada paso y revisó el código; no escribió los archivos del proyecto)

#### Objetivo
Dejar una base de datos PostgreSQL de desarrollo y otra de test levantables con un solo comando, y hacer que la API se niegue a arrancar si faltan variables de entorno obligatorias.

#### Qué se hizo
- `docker-compose.yml` con dos servicios PostgreSQL 17: `db-dev` (puerto 5432, con volumen para conservar los datos) y `db-test` (puerto 5433, sin volumen).
- `DATABASE_URL` y `DATABASE_TEST_URL` documentadas en `.env.example` y en la tabla de variables de `docs/arquitectura.md`.
- Instaladas `@nestjs/config`, `class-validator` y `class-transformer` en `rentsmart-back`.
- `src/config/env.validation.ts`: clase `EnvironmentVariables` y función `validate`, que lanza un error con el nombre de cada variable inválida y el motivo.
- `ConfigModule.forRoot({ isGlobal: true, validate })` registrado en `AppModule`.
- `src/config/env.validation.spec.ts` con 4 pruebas: configuración válida, falta `DATABASE_URL`, `PORT` no numérico y conversión de `PORT` de texto a número.

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| Dos servicios separados (`db-dev` y `db-test`) con usuarios y bases distintos | Una sola base para todo; un solo contenedor con dos bases | Los tests de integración pueden borrar datos sin tocar los de desarrollo, y cada servicio se entiende por separado |
| Volumen solo en `db-dev` | Volumen en ambas | La base de test debe partir limpia; la de desarrollo debe conservar los datos entre reinicios |
| Credenciales de desarrollo escritas directamente en el compose y en `.env.example` | Leerlas desde un `.env` de la raíz | Son valores solo para local y así `docker compose up` funciona sin configurar nada. Si se cambia uno, hay que cambiar el otro |
| Validar con `class-validator` | Joi o zod | El proyecto ya usa `class-validator` en los DTOs (`AGENTS.md`), así se evita una segunda librería |
| `DATABASE_TEST_URL` y `PORT` opcionales; `DATABASE_URL` obligatoria | Exigir todas | Solo `DATABASE_URL` es necesaria para arrancar; la de test la usan únicamente los tests de integración y `PORT` tiene valor por defecto |
| `import 'reflect-metadata'` al inicio de `env.validation.ts` | Importarlo solo en el spec | `@Type()` de `class-transformer` necesita `Reflect.getMetadata`. En la API lo carga Nest, pero en un test aislado no. Así el archivo funciona en cualquier contexto |

#### Archivos principales
- `docker-compose.yml`: bases `db-dev` y `db-test`.
- `.env.example`: `DATABASE_URL` y `DATABASE_TEST_URL`.
- `docs/arquitectura.md`: tabla de variables de entorno.
- `rentsmart-back/src/config/env.validation.ts`: validación de variables.
- `rentsmart-back/src/config/env.validation.spec.ts`: pruebas de la validación.
- `rentsmart-back/src/app.module.ts`: registro de `ConfigModule`.
- `rentsmart-back/package.json` y `package-lock.json`: dependencias nuevas.

#### Cómo probarlo
- Bases de datos (Docker Desktop encendido): `docker compose up -d`, luego `docker compose ps` y `docker compose exec db-dev psql -U devuser -d devdb -c "SELECT 1;"`.
- Tests y calidad, desde `rentsmart-back`: `npm test`, `npm run lint` y `npm run build`.
- Validación al arrancar: `cp ../.env.example .env` y `npm run start:dev` debe arrancar. Si se borra `DATABASE_URL` del `.env`, debe negarse a arrancar y nombrar la variable.

#### Estado de verificación
- Build: ✅
- Lint: ✅ (0 advertencias, 0 errores)
- Tests: ✅ (2 suites, 5 pruebas)

#### Pendientes y bloqueos
- F-03 (#3): modelo de datos, migración y seed con Prisma. Necesita estas bases de datos y usará `DATABASE_URL`.
- El arranque de la API sin `DATABASE_URL` y `docker compose up` con las dos bases se probaron a mano solo si consta en el PR. Confirmar antes de mergear.
- Falta abrir el PR con `Closes #4`; lo revisa B (@xReNatS) según la rotación.

#### Para el resto del equipo
- Desde ahora la API exige `DATABASE_URL` en `rentsmart-back/.env`. Copien `.env.example` como `.env` (`cp .env.example rentsmart-back/.env`) o el back no arranca.
- Antes de trabajar con datos: `docker compose up -d` en la raíz del repo.
- Los tests de integración deben usar `DATABASE_TEST_URL` (puerto 5433), nunca `DATABASE_URL`.
- Al usar decoradores de `class-transformer` fuera de Nest (tests, scripts), importar `reflect-metadata` primero.

---

### 2026-09-27 · A (AlejandroMG) · F-03 modelo de datos v1 con Prisma, migraciones y seed

**Issues:** #3 (F-03)
**Rama / PR:** `feat/F-03-prisma-schema-seed` (sale de `feat/F-04-postgres-docker`) · sin PR todavía
**Duración aproximada:** 3 h
**Herramientas:** Claude Code (ayuda en redacción de `schema.prisma` y revisión del seed y de `PrismaService`)

#### Objetivo
Modelo de datos de los tres dominios en Prisma, migraciones reproducibles, datos de prueba y un `PrismaService` inyectable.

#### Qué se hizo
- Prisma 7.10.0 con `@prisma/adapter-pg`; `prisma.config.ts` con schema, migraciones y seed.
- `schema.prisma` con todos los modelos de `docs/arquitectura.md`.
- Migraciones `init` y `booking_no_overlap` (restricción SQL contra reservas traslapadas).
- `prisma/seed.ts`: 3 usuarios (admin, propietario, arrendatario), 8 tipos de espacio, RM con 5 comunas y 10 espacios activos con horario.
- `PrismaModule` global con `PrismaService` y un test de conexión contra la BD de test.

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| Prisma 7.10.0 fijo | 8.0.0-rc (lo que instala `latest`) | Un release candidate no es estable para la entrega |
| Campos de `Space` casi todos opcionales | Obligatorios en la BD | ES-02 guarda borradores; ES-04 valida en el servicio |
| Anti-traslape en migración SQL | Solo validar en el servicio | Prisma no lo soporta y protege contra solicitudes simultáneas |
| Seed con `upsert` | `create` | Se puede correr varias veces sin duplicar |

#### Archivos principales
- `rentsmart-back/prisma/`: schema, migraciones y seed.
- `rentsmart-back/src/prisma/`: módulo, servicio y test.
- `rentsmart-back/jest.config.ts`: mapeo de imports `.js` para el cliente generado.

#### Cómo probarlo
`docker compose up -d`; en `rentsmart-back`: `npx prisma migrate dev`, `npm run seed`, `npm test`. Usuarios `admin@`, `propietario@` y `arrendatario@rentsmart.test`, contraseña `Password123`.

#### Estado de verificación
- Build: ✅
- Lint: ✅
- Tests: ✅ (3 suites, 6 pruebas; requiere `db-test` levantada)

#### Pendientes y bloqueos
- Revisar el ERD con B y C (criterio de aceptación).
- PR con base en F-04 hasta que F-04 se mergee.

#### Para el resto del equipo
- Tras un `git pull` con migraciones: `npx prisma migrate dev`, o el back no compila.
- Usen `PrismaService` inyectado; no actualicen a `prisma@latest`.
- C: la BD rechaza reservas activas traslapadas; traducir ese error a 409. El CI necesita `db-test` y `prisma generate`.

---

### 2026-10-05 · B (xReNatS) · Resolver conflictos de los PR #86 (F-04) y #87 (F-03) y arreglar el CI de F-03

**Issues:** #4 (F-04), #3 (F-03)
**Rama / PR:** `feat/F-04-postgres-docker` (PR #86, mergeado) y `feat/F-03-prisma-schema-seed` (PR #87)
**Duración aproximada:** 1 h
**Herramientas:** Claude Code

#### Objetivo
Dejar los PR #86 y #87 sin conflictos con `main` y con el CI (F-06) en verde para poder mergearlos.

#### Qué se hizo
- Conflicto en `docs/memory.md` en ambos PR: los dos lados solo agregaban entradas al final. Se dejaron las de `main` (F-06 y F-11) y después las de F-04 y F-03, sin cambiar su contenido salvo el número de PR en "Rama / PR".
- Al mergear el #86, GitHub retargeteó el #87 a `main` y reescribió su rama en un solo commit, con lo que se perdió el cambio al CI y falló el job del back (`Cannot find module '../generated/prisma/client'`). Se volvió a aplicar sobre la rama actual.
- CI del back (`.github/workflows/ci.yml`): servicio PostgreSQL 17 `db-test` en el puerto 5433, variables `DATABASE_URL` y `DATABASE_TEST_URL`, y pasos `npx prisma generate` y `npx prisma migrate deploy` antes del lint. Sin esto el CI de F-03 falla: el cliente de Prisma no se versiona (`src/generated`), así que lint y build no lo encuentran, y el test de `PrismaService` necesita una base.

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| Merge de `main` en las ramas (no rebase) | Rebase y force-push | No reescribe el historial de ramas de otro integrante con PR abierto. Igual GitHub reescribió el #87 al mergear el #86 |
| Cambio del CI dentro del merge de F-03 | PR aparte de C | F-03 no puede pasar el CI sin él; el PR ya avisaba que el CI necesitaba `db-test` y `prisma generate` |
| `DATABASE_URL` del CI apunta a la base de test | Una segunda base en el CI | `prisma.config.ts` exige `DATABASE_URL` hasta para `generate`; en el CI no hay datos de desarrollo que proteger |
| `prisma migrate deploy` en el CI | Solo `generate` | Valida que las migraciones (incluida `booking_no_overlap`) se apliquen limpias en cada PR |

#### Archivos principales
- `docs/memory.md`: resolución de conflictos y esta entrada.
- `.github/workflows/ci.yml`: base de test y pasos de Prisma en el job del back.

#### Cómo probarlo
Simulación local del job del back desde cero, con `db-test` levantada: `npm ci`, `npx prisma generate`, `npx prisma migrate deploy`, `npm run lint`, `npm run test:cov` (con Node 24) y `npm run build`.

#### Estado de verificación
- Build: ✅ (F-04 y F-03)
- Lint: ✅ (F-04 y F-03)
- Tests: ✅ F-04 2 suites, 5 pruebas; F-03 3 suites, 6 pruebas (con `db-test`). Seed probado contra la base de test.

#### Pendientes y bloqueos
- Ambos PR necesitan 1 aprobación (protección de `main`). El autor es A; puede aprobar B o C.
- El #86 ya está mergeado; el #87 apunta a `main` y necesita 1 aprobación con el CI en verde.
- C (@gonzzza-lol): revisar el cambio al CI; toca su dominio.
- Las entradas de F-06 y F-11 en esta bitácora quedaron mezcladas al mergear el PR #90; conviene que C las ordene.

#### Para el resto del equipo
- El CI del back ahora levanta PostgreSQL y genera el cliente de Prisma. Los tests de integración deben usar `DATABASE_TEST_URL`.
- En local hay que correr `npx prisma generate` (o `npx prisma migrate dev`) tras instalar dependencias, o el back no compila.

---

### 2026-10-05 · B (xReNatS) · F-07 base del front en TypeScript: rutas, layout y componentes

**Issues:** #7 (F-07), #9 (F-09, prototipo)
**Rama / PR:** `feat/F-07-base-front-ts` · sin PR todavía
**Duración aproximada:** 3 h
**Herramientas:** Claude Code

#### Objetivo
Dejar la base del front para que A y C construyan sus pantallas: TypeScript, rutas, layout responsive, cliente HTTP y componentes base, con la identidad visual aprobada.

#### Qué se hizo
- **Prototipo de diseño (F-09).** Antes de escribir código se hizo un prototipo navegable (catálogo, detalle, publicar por pasos, panel del propietario, móvil y escritorio) basado en Peerspace y Airbnb, con dos paletas. Se aprobó la paleta A (verde azulado). El prototipo está en https://claude.ai/artifact/MipjoPHn9NVH9yknSMy9LM, un enlace privado: hay que compartirlo desde su menú Share para que A y C lo vean.
- **Migración a TypeScript (P-04).** `tsconfig` (app y node), `vite.config.ts`, `main.tsx` y `App.tsx`; ESLint con typescript-eslint; `npm run build` ahora corre `tsc -b` antes de Vite. Se quitó el código de la plantilla (`App.jsx`, `App.css`, imágenes).
- **Marca.** Colores, tipografías (Bricolage Grotesque y Figtree) y radios como variables `@theme` de Tailwind 4 en `src/index.css`; favicon propio.
- **Rutas.** `src/routes.tsx` con `AppLayout`, páginas provisorias (catálogo, detalle, publicar, mis espacios, login), 404 y `RequireAuth`, que redirige a `/login` guardando la ruta pedida.
- **Layout.** `Navbar` (menú plegable en móvil) y `Footer`, con enlace para saltar al contenido.
- **Cliente HTTP.** `src/lib/http.ts` (token Bearer, query string, JSON y FormData, `ApiError` con mensajes en español, 401 borra el token), más `token.ts`, `format.ts` (`formatClp`) y `paths.ts`.
- **Componentes.** `Button` y `LinkButton`, `Input`, `Card`, `Modal` (`<dialog>` nativo) y `Toast` (`ToastProvider` y `useToast`).
- **Guía de componentes** en `/dev/componentes`, solo en desarrollo.

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| El cliente HTTP agrega `/api` a `VITE_API_URL` | Que `VITE_API_URL` ya incluya `/api` | `.env.example` ya definía `http://localhost:3000` y el back publicará todo bajo `/api`; así no cambia la variable |
| `Modal` con `<dialog>` nativo | Librería de modales o un `div` propio | El navegador da gratis el foco atrapado, Esc y el fondo bloqueado, sin dependencias |
| React Router 7 con `createBrowserRouter` y rutas como arreglo | Rutas JSX con `<Routes>` | El arreglo se puede reutilizar con `createMemoryRouter` en los tests de F-08 |
| `RequireAuth` solo mira si hay token | Esperar el contexto de sesión de A | A todavía no entrega CU-02; cuando exista, solo hay que cambiar esta condición |
| `/login` es un placeholder en `routes.tsx` | Crear `features/auth/` | Es dominio de A; reemplaza la ruta con su pantalla |
| Íconos como SVG propios | Librería de íconos | Solo se usan cinco |

#### Archivos principales
- `rentsmart-front/src/routes.tsx`, `App.tsx`, `main.tsx`: arranque y rutas.
- `rentsmart-front/src/components/`: componentes base, layout y `RequireAuth`.
- `rentsmart-front/src/lib/`: `http.ts`, `token.ts`, `format.ts`, `paths.ts`, `cn.ts`.
- `rentsmart-front/src/index.css`: tokens de la marca.
- `rentsmart-front/eslint.config.js`, `tsconfig*.json`, `vite.config.ts`, `package.json`: toolchain TypeScript.
- `docs/arquitectura.md`, `AGENTS.md`, `.env.example`, `rentsmart-front/README.md`: documentación al día.

#### Cómo probarlo
- Desde `rentsmart-front`: `npm run lint`, `npm run build` y `npm run dev`.
- Abrir `/publish` sin sesión: debe redirigir a `/login`. Con `localStorage.setItem('rentsmart_token', 'dev')` en la consola, `/publish` y `/owner/spaces` abren.
- `/dev/componentes`: probar el modal, los avisos y el botón con carga.
- A 375 px el menú se pliega y no hay scroll horizontal.

#### Estado de verificación
- Build: ✅ (`tsc -b` y Vite)
- Lint: ✅
- Tests: no aplica todavía. F-08 agrega Vitest, Testing Library y MSW, y con ellos las pruebas del cliente HTTP, `RequireAuth` y los componentes. Se hizo así porque no hay un ejecutor de tests hasta F-08; hay que mergear F-08 antes de dar por cerrada la definición de terminado de F-07.
- Comprobado a mano en el navegador: redirección de rutas privadas, modal (abre, cierra, título enlazado), avisos de éxito y error, y menú móvil a 375 px (sin scroll horizontal). No se revisó visualmente con capturas.

#### Pendientes y bloqueos
- F-08 (#8): Vitest, Testing Library y MSW, y los tests de lo de arriba.
- F-09 (#9): adjuntar el enlace del prototipo al issue una vez compartido.
- Falta abrir el PR con `Closes #7`; lo revisa C (@gonzzza-lol).

#### Para el resto del equipo
- Ahora el front es TypeScript: los archivos nuevos van en `.ts` o `.tsx`.
- Usen las utilidades de la marca (`bg-primary`, `text-ink`, `border-line`, `font-display`, `rounded-card`) y los componentes de `src/components/`; en `/dev/componentes` están todos.
- Para llamar a la API: `import { http } from '../../lib/http'` y `http.get<Tipo>('/spaces')`. El cliente agrega `/api` y el token.
- A (@AlejandroMG): al implementar el login, usa `setToken` de `src/lib/token.ts`, cambia la condición de `RequireAuth` si necesitas el usuario, reemplaza la ruta `login` de `routes.tsx` y el botón "Ingresar" de `Navbar`.
- C (@gonzzza-lol): el detalle del espacio (BU-02) tendrá un lugar para `<BookingWidget spaceId>`, y el formulario de publicar uno para `<HorarioSemanal>`.

---

### 2026-10-05 · B (xReNatS) · F-08 pruebas del front con Vitest, Testing Library y MSW (en el mismo PR que F-07)

**Issues:** #8 (F-08); completa la definición de terminado de #7 (F-07)
**Rama / PR:** `feat/F-07-base-front-ts` · sin PR todavía
**Duración aproximada:** 1,5 h
**Herramientas:** Claude Code

#### Objetivo
Tener `npm test` corriendo en el CI y probar lo construido en F-07. Se decidió llevar F-08 en el mismo PR que F-07 para que ninguno quede sin pruebas (la entrada anterior de F-07 decía que los tests llegarían en un PR aparte).

#### Qué se hizo
- Vitest con jsdom, Testing Library y user-event, y MSW para simular la API. Scripts `test` y `test:watch`; el CI ya ejecutaba `npm test --if-present`, así que desde ahora corre las pruebas sin tocar el workflow.
- `src/test/setup.ts`: jest-dom, ciclo de vida de MSW (una petición sin handler falla el test), limpieza de `localStorage` entre pruebas y simulación de `<dialog>`, que jsdom no implementa.
- `src/mocks/`: `handlers.ts` (ejemplo: `GET /api/space-types`), `server.ts` para los tests y `browser.ts` con el service worker (`public/mockServiceWorker.js`), activado con `VITE_USE_MOCKS=true`.
- 60 pruebas en 10 archivos: cliente HTTP (token, query string, JSON, FormData, 204, mensajes de error, 401, red caída y cancelación), token, `formatClp` y `cn`, un endpoint simulado de ejemplo, `Button`, `LinkButton`, `Input`, `Modal`, `Toast`, `Navbar` y las rutas (redirección a `/login` guardando la ruta pedida, acceso con token, 404).
- Las pruebas encontraron un fallo real: el cliente HTTP no dejaba pasar la cancelación (`AbortError`) y la convertía en error de red, porque comparaba con `instanceof DOMException`. Ahora compara por nombre.

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| F-08 en el mismo PR que F-07 | Dos PR apilados | Cada historia debe terminar con tests; son piezas que se revisan juntas (el PR crece, pero es la base del front) |
| `onUnhandledRequest: 'error'` en los tests | Dejar pasar a la red | Un test no debe depender de un servidor real ni pasar por accidente |
| Se simula `<dialog>` en el setup | Cambiar el `Modal` por un `div` | El `<dialog>` nativo da foco, Esc y fondo bloqueado; jsdom solo necesita `showModal` y `close` |
| Worker de MSW para el navegador con una variable opcional | Solo MSW en los tests | `docs/arquitectura.md` prevé mocks mientras el back no exista, para que A y C avancen |
| Un solo handler de ejemplo | Mockear catálogo y espacios | El contrato de la API (F-05) todavía no está definido; cada dominio agrega los suyos |

#### Archivos principales
- `rentsmart-front/vite.config.ts`: bloque `test`.
- `rentsmart-front/src/test/setup.ts`, `src/mocks/*`, `public/mockServiceWorker.js` (generado con `npx msw init public/`).
- `rentsmart-front/src/**/*.test.ts(x)`: las pruebas, junto al código.
- `rentsmart-front/src/lib/http.ts`: corrección de la cancelación.
- `docs/arquitectura.md`, `.env.example`, `rentsmart-front/README.md`: variable `VITE_USE_MOCKS` y sección de pruebas.

#### Cómo probarlo
Desde `rentsmart-front`: `npm test`, `npm run lint` y `npm run build`.

#### Estado de verificación
- Build: ✅
- Lint: ✅
- Tests: ✅ (10 archivos, 60 pruebas)
- No verificado: el worker de MSW en el navegador. En el navegador integrado de la herramienta el service worker no se registra (ni a mano), aunque el servidor entrega el script bien. Hay que probar `VITE_USE_MOCKS=true npm run dev` en Chrome o Edge antes de contar con ello.

#### Pendientes y bloqueos
- Probar el worker de MSW en un navegador real.
- Abrir el PR con `Closes #7` y `Closes #8`; lo revisa C (@gonzzza-lol).

#### Para el resto del equipo
- Los tests van junto al código (`Algo.test.tsx`) y usan `render` de Testing Library. Para probar una pantalla con rutas: `createMemoryRouter(routes, { initialEntries: [...] })` (ejemplo en `src/routes.test.tsx`).
- Para simular un endpoint: agrega un handler en `src/mocks/handlers.ts`; en un test puntual, `server.use(...)`.
- Cualquier petición a la API sin handler hace fallar el test: es a propósito.

---

### 2026-10-05 · B (xReNatS) · F-05 base de la API y ES-01 datos de referencia (back)

**Issues:** #20 (ES-01); parte de B de #5 (F-05)
**Rama / PR:** `feat/ES-01-space-types` · sin PR todavía
**Duración aproximada:** 2 h
**Herramientas:** Claude Code

#### Objetivo
Dejar la API con la configuración que prometen los docs (prefijo `/api`, validación global y Swagger) y publicar las listas de referencia que necesitan los formularios y filtros: tipos de espacio, equipamiento, regiones y comunas.

#### Qué se hizo
- `src/app.setup.ts`: prefijo `/api`, `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`) y Swagger en `/docs` con `@nestjs/swagger`. Lo usan `main.ts` y los tests e2e, así se prueba la misma configuración que corre en producción. `main.ts` ahora crea la app con `rawBody: true` (lo necesita el webhook de Stripe).
- Módulo `space-types` con `GET /api/space-types`, `/api/amenities`, `/api/regions` y `/api/regions/:id/communes` (404 si la región no existe, 400 si el id no es un número). Públicos y de solo lectura.
- Pruebas: unitarias del servicio y e2e con Supertest contra la base de test. Cada e2e crea y borra sus propios datos, no depende del seed.
- `test/utils/setup-env.ts`: los e2e usan `DATABASE_TEST_URL` y fallan si falta, para no tocar nunca la base de desarrollo. `jest-e2e.json` gana el mapeo de imports `.js` del cliente de Prisma.
- CI: nuevo paso `npm run test:e2e` en el job del back (la BD de test y las migraciones ya estaban). Toca el CI de C.

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| Un módulo `space-types` con tres controladores y un servicio | Módulos `amenities` y `regions` aparte | `docs/arquitectura.md` asigna al módulo `space-types` los cuatro catálogos |
| Configuración común en `app.setup.ts` | Repetirla en `main.ts` y en cada e2e | Un test e2e que no usa el prefijo ni la validación real no prueba lo que corre |
| e2e crean sus datos con un sufijo único | Depender del seed | Funciona igual con la base vacía del CI y con la sembrada en local |
| Paso de e2e en el CI | Dejarlos solo locales | Sin él, el requisito de "un test de integración por endpoint" nunca se comprueba en los PR |
| Swagger y `/api` van en esta rama, no en un PR aparte de F-05 | Un PR solo de infraestructura | Es poco código y ES-01 los necesita para tener sentido; el contrato completo (F-05) sigue abierto |

#### Archivos principales
- `rentsmart-back/src/app.setup.ts`, `src/main.ts`, `src/app.module.ts`.
- `rentsmart-back/src/space-types/`: módulo, tres controladores, servicio, DTO y su prueba.
- `rentsmart-back/test/`: `app.e2e-spec.ts`, `space-types.e2e-spec.ts`, `utils/` y `jest-e2e.json`.
- `.github/workflows/ci.yml`, `docs/arquitectura.md`: paso de e2e y documentación de los endpoints.

#### Cómo probarlo
- Con `docker compose up -d db-test` y, en `rentsmart-back`: `DATABASE_URL=<la de test> npx prisma migrate deploy`, luego `npm run lint`, `npm run build`, `npm test` y `npm run test:e2e` (Node 24).
- `npm run start:dev`: Swagger en http://localhost:3000/docs y `GET http://localhost:3000/api/space-types` (con `npm run seed` devuelve los 8 tipos).

#### Estado de verificación
- Build: ✅
- Lint: ✅
- Tests unitarios: ✅ (4 archivos, 12 pruebas; el de `PrismaService` usa la base de test)
- Tests e2e: ✅ (2 archivos, 9 pruebas) contra la base de test, sin exportar `DATABASE_URL` (toma `DATABASE_TEST_URL` del `.env`). Al terminar no quedan filas de prueba en la base.

#### Pendientes y bloqueos
- A (@AlejandroMG): `main.ts` ya tiene el prefijo y el `ValidationPipe`; CU-05 solo necesita sumar helmet, CORS y `FRONTEND_URL`.
- C (@gonzzza-lol): revisar el paso de e2e que se agregó al CI.

#### Para el resto del equipo
- Todas las rutas llevan el prefijo `/api`. Un controlador nuevo no debe repetirlo; solo Swagger vive fuera, en `/docs`.
- Para un e2e nuevo: `createTestApp()` de `test/utils/` y datos propios con un sufijo único.

---

### 2026-10-05 · Agente (Antigravity) · Resolver conflicto de merge en PR #92

**Issues:** PR #92
**Rama / PR:** `feat/ES-01-space-types` · PR #92
**Duración aproximada:** 15 min
**Herramientas:** Antigravity

#### Objetivo
Resolver el conflicto de merge entre `main` y la rama `feat/ES-01-space-types`.

#### Qué se hizo
- Se hizo merge de `origin/main` en la rama `feat/ES-01-space-types`.
- Se resolvió el conflicto en `docs/memory.md` conservando la entrada que venía de la rama y las de `main` en orden cronológico.

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| Conservar ambas entradas en `docs/memory.md` | Sobrescribir una | Cumple la regla 4 de AGENTS.md |

#### Archivos principales
- `docs/memory.md`: archivo donde ocurrió el conflicto.

#### Cómo probarlo
N/A

#### Estado de verificación
- Build: ✅
- Lint: ✅
- Tests: ✅

#### Pendientes y bloqueos
- Merge y push a origin pendientes de aprobación manual.

#### Para el resto del equipo
- Conflicto de PR #92 resuelto localmente y listo para subir.

---

### 2026-10-05 · B (xReNatS) · ES-02 espacios del propietario y autenticación temporal (back)

**Issues:** #21 (ES-02), parte del back
**Rama / PR:** `feat/ES-02-spaces-api`, apilada sobre `feat/ES-01-space-types` (PR #92) · sin PR todavía
**Duración aproximada:** 2 h
**Herramientas:** Claude Code

#### Objetivo
Adelantar el back de "publicar un espacio" sin esperar el login de A: crear y editar el borrador del espacio, con la autenticación mientras tanto resuelta con un guard temporal que se puede cambiar por el real sin tocar los controladores.

#### Qué se hizo
- Módulo `spaces`: `POST /api/spaces` (crea en `DRAFT`, solo el nombre es obligatorio), `PATCH /api/spaces/:id` (parcial; `null` borra un campo opcional; `amenityIds` reemplaza el equipamiento) y `GET /api/spaces/:id` (con el detalle privado de la dirección). Solo el dueño accede: 403 si es de otro, 404 si no existe.
- Validación de referencias: tipo, región, comuna y equipamiento deben existir, y la comuna debe ser de la región; si solo llega la comuna se guarda su región. El estado y el dueño no se pueden mandar (400).
- `src/common/auth/`: `DevAuthGuard` (usuario por `x-user-id` o el propietario del seed), `@CurrentUser()` y `AuthUser`. Con `NODE_ENV=production` el guard rechaza todo.
- Pruebas: 17 unitarias nuevas (servicio y guard) y 30 e2e nuevos. Se rompió a propósito la comprobación de dueño para verificar que los tests de 403 la detectan (se restauró).
- Documentación en `docs/arquitectura.md`.

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| `DevAuthGuard` temporal con la forma del guard real | Esperar a A; o construir el login yo | Desbloquea ES-02 a ES-06 y PN-01 sin invadir el dominio de A; el cambio a JWT es reemplazar el guard en cada `@UseGuards` |
| El guard no funciona en producción | Dejarlo y confiar en que se reemplace | Cualquiera podría hacerse pasar por otro usuario; un olvido no debe llegar a producción |
| Casi todos los campos opcionales y `null` para borrar | Campos obligatorios por paso | El formulario guarda un borrador en cada paso; las reglas para publicar son de ES-04 |
| Reemplazar todo el equipamiento en cada `PATCH` | Agregar y quitar por separado | El formulario manda la selección completa; es más simple y no hay estados intermedios |
| 403 (y no 404) para el espacio de otro | 404 para no revelar que existe | Lo pide el AGENTS.md y los ids son uuid; no hay nada que adivinar |

#### Archivos principales
- `rentsmart-back/src/spaces/`: módulo, controlador, servicio, DTOs y prueba.
- `rentsmart-back/src/common/auth/`: guard temporal, decorador y tipo.
- `rentsmart-back/test/spaces.e2e-spec.ts`.
- `docs/arquitectura.md`.

#### Cómo probarlo
- Con `docker compose up -d db-test`, en `rentsmart-back` (Node 24): `npm run lint`, `npm run build`, `npm test` y `npm run test:e2e`.
- A mano: `npm run seed`, `npm run start:dev` y en Swagger (`/docs`) probar `POST /api/spaces` (sin `x-user-id` actúa el propietario del seed).

#### Estado de verificación
- Build: ✅
- Lint: ✅
- Tests unitarios: ✅ (6 archivos, 29 pruebas)
- Tests e2e: ✅ (3 archivos, 39 pruebas)

#### Pendientes y bloqueos
- Depende de que se mergee el PR #92.
- ES-03 (fotos), ES-04 (publicar), ES-05/06 (editar y activar) y `GET /api/spaces/me` (PN-01) siguen pendientes.
- A (@AlejandroMG): cuando entregue CU-03, reemplazar `DevAuthGuard` por `JwtAuthGuard` en `SpacesController` y borrar `dev-auth.guard.ts`. `@CurrentUser()` y `AuthUser` pueden quedar si el guard real deja `request.user` con la misma forma.

#### Para el resto del equipo
- Para proteger un endpoint nuevo: `@UseGuards(DevAuthGuard)` y `@CurrentUser() user: AuthUser`. En los e2e, `set('x-user-id', id)` actúa como ese usuario.
- Los permisos por dueño se comprueban en el servicio, no en el controlador.

---

### 2026-10-05 · B (xReNatS) · ES-03 subir y ordenar fotos (back) y almacenamiento de archivos

**Issues:** #22 (ES-03), parte del back
**Rama / PR:** `feat/ES-03-photos-api`, apilada sobre `feat/ES-02-spaces-api` (que depende del PR #92) · sin PR todavía
**Duración aproximada:** 2,5 h
**Herramientas:** Claude Code

#### Objetivo
Permitir que el propietario suba de 1 a 10 fotos a su espacio, las ordene (la primera es la portada) y las borre, con un `StorageService` intercambiable: disco local mientras no haya credenciales de Supabase.

#### Qué se hizo
- Módulo `storage`: `StorageService` (clase abstracta), `LocalStorageService` (disco, servido en `/api/uploads`) y `SupabaseStorageService` (API REST de Supabase con `fetch`, sin dependencias). Se elige con `STORAGE_DRIVER`; con `supabase` la API no arranca si faltan `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` o `SUPABASE_BUCKET`.
- Endpoints: `POST /api/spaces/:id/photos` (multipart `file`), `PATCH /api/spaces/:id/photos/order` y `DELETE /api/spaces/:id/photos/:photoId`. `GET /api/spaces/:id` ahora trae `photos` ordenadas.
- Reglas: JPG, PNG o WebP de hasta 5 MB (413 si pesa más) y hasta 10 por espacio (409). El formato se reconoce por los primeros bytes, no por el nombre ni el tipo declarado. El archivo se guarda con un nombre propio y el original se descarta.
- Subidas simultáneas: se bloquea la fila del espacio (`FOR UPDATE`), así no se pasan de 10 ni repiten posición. Al borrar una foto, las siguientes suben una posición.
- Si la base falla o se pasa del límite después de subir el archivo, se borra el archivo; si borrarlo falla, se anota y se sigue.
- Pruebas: 34 unitarias nuevas (formato, almacenamiento local y de Supabase con `fetch` simulado, servicio de fotos y validación del entorno) y 19 e2e nuevos (63 y 58 en total). Se comprobó que el test de subidas simultáneas falla si se quita el bloqueo (se hizo a mano y se restauró).
- Documentación en `docs/arquitectura.md`, `.env.example` y la tabla de variables.

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| Supabase con `fetch` y la API REST | Instalar `@supabase/supabase-js` | Son dos llamadas (subir y borrar) y así se prueba con un `fetch` simulado, sin una dependencia más |
| Local por defecto, Supabase por variable | Esperar las credenciales | Desbloquea el desarrollo y los tests ahora; la implementación de Supabase está lista pero sin probar contra un proyecto real |
| Formato por los bytes del archivo | Confiar en el tipo MIME | El MIME lo manda el navegador y se puede falsear (un HTML con `Content-Type: image/png`) |
| 409 al pasar de 10 fotos | 400 | Es un conflicto con el estado actual del espacio, no un dato mal escrito (AGENTS.md) |
| Bloqueo de la fila del espacio | Contar y crear sin bloqueo | Sin él, dos subidas a la vez superaban el máximo (el test lo demuestra) |
| Las fotos locales se sirven bajo `/api/uploads` | `/uploads` | Queda dentro del proxy de Vite en desarrollo y el prefijo de la API |
| Subir primero el archivo y luego registrar | Registrar primero | Si el archivo falla no queda una fila apuntando a nada; si la fila falla se borra el archivo |

#### Archivos principales
- `rentsmart-back/src/storage/`: servicio abstracto, local, Supabase, módulo y pruebas.
- `rentsmart-back/src/spaces/`: `photos.controller`, `photos.service`, `image-type`, `dto/photo.dto` y pruebas.
- `rentsmart-back/src/config/env.validation.ts`, `src/app.setup.ts`, `src/app.module.ts`, `tsconfig.json` (tipos de multer).
- `rentsmart-back/test/photos.e2e-spec.ts` y `test/utils/setup-env.ts` (carpeta temporal para las fotos de los e2e).

#### Cómo probarlo
- Con `docker compose up -d db-test`, en `rentsmart-back` (Node 24): `npm run lint`, `npm run build`, `npm test` y `npm run test:e2e`.
- A mano: Swagger en `/docs`, `POST /api/spaces/{id}/photos` con un archivo; la foto se ve en la dirección `url` que devuelve.

#### Estado de verificación
- Build: ✅
- Lint: ✅
- Tests unitarios: ✅ (9 archivos, 63 pruebas)
- Tests e2e: ✅ (4 archivos, 58 pruebas)
- No verificado: `SupabaseStorageService` contra un proyecto real de Supabase.

#### Pendientes y bloqueos
- Depende del PR #92 y de la rama de ES-02.
- Probar el almacenamiento con Supabase real cuando haya proyecto, bucket `space-photos` público y credenciales; decidir dónde configurarlas en el despliegue (P-17).
- Borrar los archivos de un espacio cuando se borra el espacio (hoy no existe borrar espacios).
- El front de ES-03 (subir, ordenar y borrar fotos en el paso 4) va en la rama del front.

#### Para el resto del equipo
- Nunca subir `SUPABASE_SERVICE_ROLE_KEY` al repositorio ni al front.
- El catálogo público (`GET /api/catalog/:id`) ya muestra las fotos por posición, con la portada primero.

---

### 2026-10-05 · B (xReNatS) · ES-04 publicar con reglas y ES-06 activar y desactivar (back)

**Issues:** #23 (ES-04), #25 (ES-06) y parte de #24 (ES-05), parte del back
**Rama / PR:** `feat/ES-04-publish-api`, apilada sobre `feat/ES-03-photos-api` · sin PR todavía
**Duración aproximada:** 2 h
**Herramientas:** Claude Code

#### Objetivo
Cerrar el ciclo de vida del espacio en la API: publicar un borrador solo si está completo, y activar o desactivar un espacio publicado, sin que un espacio activo pueda quedar incompleto.

#### Qué se hizo
- `POST /api/spaces/:id/publish`: pasa un borrador a `ACTIVE` y marca la cuenta como propietaria (`isHost`, P-02). Si falta algo responde 409 con `missing` (`type`, `description`, `capacity`, `commune`, `price`, `photos`, `schedule`).
- `PATCH /api/spaces/:id/status` (`ACTIVE` o `INACTIVE`): desactivar saca el espacio del catálogo; activar exige seguir cumpliendo lo necesario (el espacio pudo editarse mientras estaba desactivado). Pedir el estado que ya tiene no hace nada. Un borrador no se cambia por aquí (409) y uno `BLOCKED` por un admin no se toca (403).
- Un espacio publicado no puede quedar incompleto: `PATCH /api/spaces/:id` y borrar su última foto responden 409 con `missing` (un cambio de precio, nombre o reglas sí vale). Esto adelanta parte de ES-05.
- Las reglas viven en un solo lugar (`publish-rules.ts`) y las usan publicar, reactivar y editar.
- Los cambios de estado son condicionales (`WHERE status = <anterior>`) dentro de una transacción: peticiones a la vez no se pisan.
- Decisión de producto: tipo y comuna también son obligatorios para publicar (**P-18**, registrada en `docs/decisiones.md` y `docs/producto.md`).
- Pruebas: 42 unitarias nuevas y 32 e2e nuevos (105 y 90 en esta rama). En una carpeta de integración con el catálogo, un e2e adicional comprueba el recorrido completo: el borrador no sale en el catálogo, publicado sí, desactivado ya no y reactivado vuelve, y el detalle público no muestra `addressDetail` (111 e2e en total).
- Documentación en `docs/arquitectura.md`.

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| Exigir también tipo y comuna (P-18) | Solo lo de `producto.md` | Sin ellos la tarjeta sale sin tipo ni comuna y el espacio no aparece en los filtros de BU-03; lo confirmó Renato |
| 409 con `missing` | 400 | Es un conflicto con el estado del espacio (AGENTS.md); `missing` permite al front indicar exactamente qué completar |
| Estado pedido igual al actual = 200 sin cambios | 409 | Un doble clic o un reintento no debe dar error |
| Un espacio activo no puede quedar incompleto | Dejarlo y que el catálogo tolere vacíos | Si no, "publicado" dejaría de significar "completo" y el catálogo mostraría espacios sin precio ni fotos |
| Publicar y cambiar estado en endpoints distintos | Un solo `PATCH status` | Publicar tiene efectos propios (`isHost`) y reglas de borrador; el cambio ACTIVE/INACTIVE es otra cosa |
| El horario se valida contra `AvailabilityRule` | Esperar a DI-01 | Es lo que dice el plan; mientras C no entregue DI-01 un espacio nuevo no se puede publicar desde la app |

#### Archivos principales
- `rentsmart-back/src/spaces/`: `publication.service`, `publish-rules`, `incomplete-space.exception`, `dto/change-status.dto`, y cambios en `spaces.controller`, `spaces.service` y `photos.service`.
- `rentsmart-back/test/publication.e2e-spec.ts` y las pruebas unitarias.
- `docs/decisiones.md` (P-18), `docs/producto.md`, `docs/arquitectura.md`.

#### Cómo probarlo
- Con `docker compose up -d db-test`, en `rentsmart-back` (Node 24): `npm run lint`, `npm run build`, `npm test` y `npm run test:e2e`.
- A mano: en Swagger, `POST /api/spaces/{id}/publish` sobre un borrador incompleto devuelve la lista de lo que falta.

#### Estado de verificación
- Build: ✅
- Lint: ✅
- Tests unitarios: ✅ (11 archivos, 105 pruebas)
- Tests e2e: ✅ (5 archivos, 90 pruebas en esta rama; 111 con el catálogo integrado)
- Nota: el e2e de "peticiones a la vez" detecta quitar la condición del estado solo a veces (la carga no siempre se cruza); la garantía real la dan la condición del `UPDATE` y su prueba unitaria.

#### Pendientes y bloqueos
- El horario semanal (DI-01, de C): sin él no se puede publicar un espacio nuevo desde la app.
- Front: agregar tipo y comuna a la lista "Para publicar necesitas", conectar "Publicar espacio" y el interruptor activar/desactivar del panel (PN-01).
- Cuando el catálogo y `spaces` estén en `main`, agregar el e2e de recorrido completo (publicar → catálogo) como prueba permanente; hoy vive solo en la carpeta de integración porque cada rama tiene un solo lado.
- Admin: bloquear y desbloquear espacios (AD-02) pondrá `BLOCKED`.

#### Para el resto del equipo
- C (@gonzzza-lol): para que publicar funcione, DI-01 debe crear `AvailabilityRule` del espacio; con una regla basta para el chequeo.
- A (@AlejandroMG): al reemplazar `DevAuthGuard` por el JWT, los endpoints nuevos usan el mismo patrón.
- Las reservas confirmadas de un espacio desactivado se mantienen: C debe impedir reservas nuevas solo cuando `status !== 'ACTIVE'`.

---

### 2026-10-05 · B (xReNatS) · PN-01 mis espacios (back)

**Issues:** #48 (PN-01), parte del back
**Rama / PR:** `feat/PN-01-owner-spaces-api`, apilada sobre `feat/ES-04-publish-api` · sin PR todavía
**Duración aproximada:** 45 min
**Herramientas:** Claude Code

#### Objetivo
Dar al panel "Mis espacios" los datos que necesita: la lista de los espacios del usuario con su estado y lo que le falta a cada uno.

#### Qué se hizo
- `GET /api/spaces/me`: los espacios del usuario, de cualquier estado, los modificados más recientemente primero. Cada uno trae `{ id, status, name, typeName, communeName, pricePerHour, pricePerDay, coverUrl, missing, updatedAt }`. `missing` usa las mismas reglas que publicar, así el panel puede decir "Falta: foto y horario" sin repetir la lógica.
- La ruta `me` va antes de `:id` y hay un test que comprueba que no se confunde con un id.
- Sin datos privados: no devuelve `addressDetail` ni `ownerId` (hay test).
- Pruebas: 4 unitarias y 7 e2e nuevas (109 y 97 en esta rama).

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| `missing` calculado en el back | Que el front lo deduzca | Una sola regla (`publish-rules.ts`) para publicar, editar y listar |
| Lista sin paginar | `?page=&pageSize=` | Un propietario tendrá pocos espacios en el MVP; se pagina si hace falta |
| Sin "próximas reservas" todavía | Consultar `Booking` ahora | Las reservas son del equipo de C (RE-02 a RE-04) y hoy no existen; el panel las mostrará cuando haya datos |

#### Archivos principales
- `rentsmart-back/src/spaces/`: `spaces.controller`, `spaces.service`, `dto/owner-space-summary.dto` y pruebas.
- `rentsmart-back/test/my-spaces.e2e-spec.ts`.
- `docs/arquitectura.md`.

#### Cómo probarlo
Con `docker compose up -d db-test`, en `rentsmart-back` (Node 24): `npm run lint`, `npm run build`, `npm test` y `npm run test:e2e`.

#### Estado de verificación
- Build: ✅
- Lint: ✅
- Tests unitarios: ✅ (11 archivos, 109 pruebas)
- Tests e2e: ✅ (6 archivos, 97 pruebas)

#### Pendientes y bloqueos
- Próximas reservas del propietario (PN-01) y reservas por estado (PN-02): dependen de C.
- El front del panel.

#### Para el resto del equipo
- C (@gonzzza-lol): cuando existan las reservas, el panel necesitará `GET /api/spaces/me` con las próximas reservas de cada espacio; avísame el contrato.

---
