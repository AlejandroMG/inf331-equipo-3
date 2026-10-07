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

### 2026-10-05 · A (AlejandroMG) · CU-01 registro con email y contraseña

**Issues:** #12 (CU-01)
**Rama / PR:** `feat/CU-01-registro` · sin PR todavía
**Duración aproximada:** 2 h
**Herramientas:** Claude Code

#### Objetivo
Que un visitante cree su cuenta con email y contraseña, con errores de validación claros en la API y en el formulario.

#### Qué se hizo
- Módulo `auth` en el back: `POST /api/auth/register` (201), con `RegisterDto` y `PublicUserDto` documentados en Swagger.
- Contraseña hasheada con bcrypt; la respuesta nunca incluye `passwordHash`. Email repetido → 409; datos inválidos → 400 con mensajes en español.
- Pantalla `/register` en el front con validación previa al envío, el 409 junto al campo email y redirección al login con el email.
- CORS en `app.setup.ts` (archivo de B) con la variable `FRONTEND_URL` (por defecto `http://localhost:5173`): sin él, el navegador bloqueaba las peticiones del front a la API y el formulario mostraba "No pudimos conectar con el servidor".
- Botón "Crear cuenta" en el `Navbar` (componente de B), en escritorio y en el menú móvil.
- Handler de MSW para `POST /api/auth/register` (`existe@rentsmart.test` simula un email usado).

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| Email en minúsculas y sin espacios | Guardarlo como viene | "Ana@Mail.com" y "ana@mail.com" deben ser la misma cuenta |
| 409 también ante el error P2002 del índice único | Solo revisar antes de crear | Dos registros simultáneos pasarían la revisión; la BD rechaza el segundo |
| Contraseña de 8 a 72 caracteres | Sin máximo | bcrypt solo considera los primeros 72 bytes |
| CORS solo para `FRONTEND_URL` | Permitir cualquier origen | Solo el front de RentSmart debe poder llamar a la API desde el navegador |
| Rechazar campos extra (`role`, etc.) | Ignorarlos | Nadie puede registrarse como ADMIN; lo cubre un test |

#### Archivos principales
- `rentsmart-back/src/auth/`: módulo, servicio, controlador, DTOs y test unitario.
- `rentsmart-back/test/auth-register.e2e-spec.ts`: integración contra la BD de test.
- `rentsmart-front/src/features/auth/`: `RegisterPage`, validación, cliente y tests.
- `rentsmart-front/src/routes.tsx`, `lib/paths.ts`, `mocks/handlers.ts`, `components/Navbar.tsx`.
- `rentsmart-back/src/app.setup.ts`, `config/env.validation.ts`, `.env.example`, `docs/arquitectura.md`: CORS y `FRONTEND_URL`.

#### Cómo probarlo
`docker compose up -d`; en `rentsmart-back`: `npm test` y `npm run test:e2e`; en `rentsmart-front`: `npm test`. A mano: `npm run start:dev` en ambos, abrir `/register` y ver el endpoint en http://localhost:3000/docs.

#### Estado de verificación
- Build: ✅ back y front
- Lint: ✅ back y front
- Tests: ✅ back 17 unitarios y 18 e2e; front 67 (7 nuevos)

#### Pendientes y bloqueos
- CU-02 (login con JWT) sale de esta rama; ahí se agrega el link "Crear cuenta" en la pantalla de login.

#### Para el resto del equipo
- Antes de `npm run test:e2e` en local hay que migrar la BD de test una vez: `DATABASE_URL` apuntando a 5433 y `npx prisma migrate deploy`.
- B: toqué `app.setup.ts` (CORS) y `Navbar.tsx` (botón "Crear cuenta"); revisen esos cambios en el PR.
- Si el front corre en otro puerto u origen, definan `FRONTEND_URL` en `rentsmart-back/.env`.
- Los usuarios se crean con `role: USER` e `isHost: false`; `isHost` se activa al publicar el primer espacio (CU-04).

---

### 2026-10-06 · A (AlejandroMG) · CU-02 iniciar y cerrar sesión con JWT

**Issues:** #13 (CU-02)
**Rama / PR:** `feat/CU-02-login` (sale de `feat/CU-01-registro`) · sin PR todavía
**Duración aproximada:** 2 h
**Herramientas:** Claude Code

#### Objetivo
Iniciar sesión con email y contraseña, recibir un token con expiración, bloquear cuentas suspendidas y poder cerrar sesión desde el front.

#### Qué se hizo
- `POST /api/auth/login` → `{ accessToken, user }`. El JWT lleva `sub` (id) y `role` y expira según `JWT_EXPIRES_IN` (por defecto `1d`).
- 401 con el mismo mensaje si el email no existe o la contraseña es incorrecta; 403 si la cuenta está `SUSPENDED`.
- Variables `JWT_SECRET` (obligatoria, mínimo 32 caracteres) y `JWT_EXPIRES_IN` validadas al arrancar, en `.env.example`, `arquitectura.md` y el CI.
- Front: pantalla `/login` (precarga el email del registro, vuelve a la ruta privada pedida), botón "Salir" en el `Navbar` con sesión y `useToken()` en `lib/token.ts` para que la interfaz reaccione al iniciar o cerrar sesión.

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| Mismo mensaje y mismo tiempo de respuesta para email inexistente y contraseña incorrecta (hash de relleno) | Decir cuál falló | No se puede averiguar qué emails tienen cuenta |
| 403 de suspensión solo si la contraseña es correcta | Revisar el estado antes | Quien no sabe la contraseña no se entera de que la cuenta existe |
| `JWT_SECRET` obligatoria, sin valor por defecto | Un secreto por defecto en el código | Un secreto conocido permitiría fabricar tokens |
| Cerrar sesión solo en el front (borrar el token) | Endpoint de logout con lista negra | El JWT no guarda estado en el servidor; alcanza para el MVP |
| Guard propio con `@nestjs/jwt` en CU-03, sin Passport | Passport | Menos piezas y más fácil de revisar |

#### Archivos principales
- `rentsmart-back/src/auth/`: login en servicio y controlador, `LoginDto`, `LoginResponseDto`, `JwtPayload`, `JwtModule`.
- `rentsmart-back/src/config/env.validation.ts` y su spec: `JWT_SECRET` y `JWT_EXPIRES_IN`.
- `rentsmart-back/test/auth-login.e2e-spec.ts`.
- `rentsmart-front/src/features/auth/LoginPage.tsx`, `lib/token.ts`, `components/Navbar.tsx` y sus tests.
- `.github/workflows/ci.yml` (de C): `JWT_SECRET` de prueba.

#### Cómo probarlo
Agregar `JWT_SECRET` a `rentsmart-back/.env`, `docker compose up -d`; en `rentsmart-back`: `npm test` y `npm run test:e2e`; en `rentsmart-front`: `npm test`. A mano: entrar con `arrendatario@rentsmart.test` / `Password123` (seed).

#### Estado de verificación
- Build: ✅ back y front
- Lint: ✅ back y front
- Tests: ✅ back 31 unitarios y 24 e2e; front 78

#### Pendientes y bloqueos
- CU-03: `JwtAuthGuard`, `RolesGuard`, `@CurrentUser()` y `GET /api/auth/me` (B y C los esperan).
- PR con base `feat/CU-01-registro` hasta que CU-01 se mergee.

#### Para el resto del equipo
- **Todos:** agreguen `JWT_SECRET` (32+ caracteres) a `rentsmart-back/.env` o la API no arranca y fallan los e2e. Ver `.env.example`.
- B: toqué `Navbar.tsx` (botón "Salir") y `lib/token.ts` (`useToken()` y `subscribeToken()`); revísenlos.
- C: agregué `JWT_SECRET` al `env` del job del back en `ci.yml`.

---

### 2026-10-05 · B (xReNatS) · BU-01 catálogo de espacios (front)

**Issues:** #27 (BU-01), parte del front
**Rama / PR:** `feat/BU-01-catalogo`, apilada sobre `feat/F-07-base-front-ts` (PR #91) · sin PR todavía
**Duración aproximada:** 1,5 h
**Herramientas:** Claude Code

#### Objetivo
Mostrar el catálogo con tarjetas y paginación según el prototipo aprobado, trabajando contra una API simulada mientras el endpoint real no exista.

#### Qué se hizo
- `CatalogPage` (`/`): estado de carga con esqueletos, error con botón "Reintentar", estado vacío, grilla de tarjetas y paginación. La página vive en la URL (`?page=2`); una página inválida vuelve a la 1.
- `SpaceCard`: tipo, nombre, comuna, capacidad, precio por hora y/o por día, portada o marcador, y la etiqueta "Nuevo" (todos lo son hasta que existan reseñas, RS-02). Toda la tarjeta enlaza al detalle.
- `Pagination` (componente compartido, con enlaces reales) y `pageItems` en `src/lib/pagination.ts`.
- `useCatalog` y `catalog-api.ts`: la petición se cancela al cambiar de página o salir de la pantalla.
- Contrato propuesto de `GET /api/catalog`, documentado en `docs/arquitectura.md`, y su simulación en `src/mocks` (14 espacios de ejemplo).
- 26 pruebas nuevas (86 en total).

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| El contrato del catálogo lo propone el front y el back lo sigue | Esperar a F-05 | F-05 sigue abierto y el plazo es corto; con MSW el front avanza y el back se ajusta a esta forma |
| Estado de la petición derivado de un identificador (`request`) | `setState('loading')` dentro del efecto | La regla `react-hooks` de ESLint 7 prohíbe cambiar estado de forma síncrona en un efecto, y así nunca se ve la página anterior bajo un número nuevo |
| Paginación con `<Link>` y no con botones | Botones con `setSearchParams` | Se puede abrir una página en otra pestaña y el estado ya está en la URL, lo que BU-03 necesita para los filtros |
| Etiqueta "Nuevo" fija | Quitarla hasta que haya reseñas | Está en el prototipo aprobado; hay un comentario para sacarla en RS-02 |

#### Archivos principales
- `rentsmart-front/src/features/catalog/`: `CatalogPage`, `SpaceCard`, `useCatalog`, `catalog-api`, `types` y sus pruebas.
- `rentsmart-front/src/components/Pagination.tsx` y `src/lib/pagination.ts`.
- `rentsmart-front/src/mocks/`: `catalog-data.ts` y el handler de `/api/catalog`.

#### Cómo probarlo
- Desde `rentsmart-front`: `npm run lint`, `npm run build` y `npm test`.
- Visual: `VITE_USE_MOCKS=true npm run dev` en Chrome o Edge, o un servidor que responda `/api/catalog` con la forma del contrato. Se probó así a 375 px y en escritorio.

#### Estado de verificación
- Build: ✅
- Lint: ✅
- Tests: ✅ (14 archivos, 86 pruebas)
- Comprobado en el navegador contra un servidor de prueba que respondía el contrato: 12 tarjetas de igual alto en 3 columnas, página 2 con 2 tarjetas en 1 columna a 375 px y sin scroll horizontal.

#### Pendientes y bloqueos
- El endpoint real `GET /api/catalog` (lado back de BU-01) y el detalle (BU-02).
- Los filtros llegan con BU-03; el diseño ya deja la URL como fuente de verdad.
- Depende de que el PR #91 (F-07 y F-08) esté mergeado.

#### Para el resto del equipo
- Para listar con paginación, usa `Paginated<T>` de `src/features/catalog/types.ts` y el componente `Pagination`.
- C: las tarjetas enlazan a `/spaces/:id`; ahí irá `<BookingWidget>` (BU-02).

---

### 2026-10-05 · B (xReNatS) · BU-02 detalle del espacio (front)

**Issues:** #28 (BU-02), parte del front
**Rama / PR:** `feat/BU-02-detalle`, apilada sobre `feat/BU-01-catalogo` (que depende del PR #91) · sin PR todavía
**Duración aproximada:** 1,5 h
**Herramientas:** Claude Code

#### Objetivo
Mostrar el detalle de un espacio según el prototipo aprobado: galería, descripción, equipamiento, reglas, horario, ubicación, reseñas y una caja de reserva con el lugar para el widget de C.

#### Qué se hizo
- `SpaceDetailPage` (`/spaces/:spaceId`): estado de carga, 404 con aviso y enlace al catálogo, error con "Reintentar", y las secciones que el espacio tiene (las vacías se omiten).
- `Gallery`: foto principal y miniaturas accesibles (botones con `aria-pressed`); sin fotos muestra un marcador.
- `groupSchedule`: agrupa los días consecutivos con el mismo horario ("Lunes a viernes 09:00 – 21:00", "Sábado y domingo no disponible"); el domingo (0) va al final.
- `BookingSlot`: lugar del widget de reserva. Hoy dice que la reserva estará disponible pronto; C lo reemplaza por `<BookingWidget spaceId={...} />`.
- `useRequest` (`src/lib/useRequest.ts`): el hook de carga que antes estaba dentro de `useCatalog`, ahora genérico. `useCatalog` y `useSpace` lo usan.
- Handler de MSW para `GET /api/catalog/:id` (404 si no existe) y tipos del detalle según el contrato del back.
- 28 pruebas nuevas (114 en total).

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| Extraer `useRequest` | Repetir el patrón en cada pantalla | Ya había dos pantallas con la misma lógica de cancelación y carga; las que vienen (panel, editar) también la necesitan |
| Sin mapa en la ubicación | El marcador de mapa del prototipo | El mapa es el extra ES-07; un recuadro vacío para el usuario no aporta |
| La caja de reserva muestra un aviso y no un recuadro de desarrollo | Dejar la anotación "lo construye el equipo C" | Es texto que vería un usuario real; el comentario para C queda en el código de `BookingSlot` |
| Secciones sin datos se omiten | Mostrar títulos vacíos | Un espacio puede publicarse sin reglas o equipamiento |
| La etiqueta "Nuevo · sin reseñas aún" es fija | Quitarla | Está en el prototipo aprobado; se saca en RS-02 |

#### Archivos principales
- `rentsmart-front/src/features/catalog/`: `SpaceDetailPage`, `Gallery`, `BookingSlot`, `schedule`, `useSpace`, `catalog-api` y `types`, con sus pruebas.
- `rentsmart-front/src/lib/useRequest.ts` (y su prueba).
- `rentsmart-front/src/mocks/handlers.ts`: detalle simulado.

#### Cómo probarlo
- Desde `rentsmart-front`: `npm run lint`, `npm run build` y `npm test`.
- Visual: con el back (`/api/catalog/:id`) o un servidor de prueba con el contrato. Se probó así a 375 px y en escritorio: galería con miniaturas, secciones, horario agrupado, 404 y espacio sin fotos.

#### Estado de verificación
- Build: ✅
- Lint: ✅
- Tests: ✅ (18 archivos, 114 pruebas)

#### Pendientes y bloqueos
- Depende de que se mergee el PR #91 (y BU-01 front después). El back del detalle está en `feat/BU-01-catalog-api`.
- C (@gonzzza-lol): reemplazar `BookingSlot` por `<BookingWidget spaceId={space.id} />` (RE-02).
- Probar contra el back real cuando los dos PR del back estén en `main`.

#### Para el resto del equipo
- Para cargar datos en una pantalla: `useRequest(clave, (signal) => llamada(signal))`; devuelve `data`, `error`, `loading` y `retry`.
- `ApiError` trae `status`: un 404 se puede mostrar distinto de otros errores, como hace esta pantalla.

---

### 2026-10-05 · B (xReNatS) · ES-02 formulario por pasos para publicar (front)

**Issues:** #21 (ES-02), parte del front
**Rama / PR:** `feat/ES-02-wizard`, apilada sobre `feat/BU-02-detalle` (que depende del PR #91) · sin PR todavía
**Duración aproximada:** 3 h
**Herramientas:** Claude Code

#### Objetivo
Construir el formulario por pasos de "Publica tu espacio" según el prototipo aprobado, que guarda un borrador en cada paso contra la API real (`POST` y `PATCH /api/spaces`).

#### Qué se hizo
- `PublishSpacePage` y `SpaceWizard` en `/publish` y `/publish/:spaceId` (continuar un borrador): 5 pasos (Información, Ubicación, Precio y horario, Fotos, Revisar), listas de tipos, equipamiento y comunas que vienen de la API, y la región fija (Metropolitana).
- Se guarda el borrador al cambiar de paso (Siguiente, Atrás o el indicador de pasos): el primer guardado hace `POST`, crea la URL `/publish/<id>` y los siguientes hacen `PATCH`. Si el servidor rechaza el guardado, se muestra el mensaje y no se avanza.
- Validación en el cliente: solo el nombre es obligatorio; capacidad y precios, si se escriben, deben ser enteros positivos dentro de los límites del back.
- La lista "Para publicar necesitas" se completa con lo que se escribe. Fotos y horario siguen pendientes hasta ES-03 y DI-01; el último paso resume el borrador y deja el botón "Publicar" desactivado.
- Componentes nuevos `Select` y `Textarea`, y la ruta `/login` de desarrollo (`DevLoginPage`: guarda un token y vuelve a donde se iba), solo en desarrollo.
- `vite.config.ts`: proxy de `/api` hacia `localhost:3000`. Con `VITE_API_URL=http://localhost:5173` el navegador no necesita CORS (llega con CU-05); `.env.example` y `docs/arquitectura.md` actualizados.
- Handlers de MSW de regiones, comunas, equipamiento y de los espacios (con borradores en memoria).
- 45 pruebas nuevas (159 en total).
- Probado de punta a punta en el navegador contra el back real (rama de integración local con ES-02 y el catálogo): login de desarrollo, los 4 pasos, el borrador queda en la base como `DRAFT` con todos sus campos y no aparece en el catálogo público.

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| Guardar al cambiar de paso, no con un botón aparte | Botón "Guardar borrador" | Es lo que promete el prototipo y evita perder trabajo |
| La URL pasa a `/publish/:id` con `state.created`, sin recargar | Redirigir y volver a cargar el borrador | Recargar reiniciaba el paso y mostraba un parpadeo; cualquier otra navegación a `/publish` sí empieza de cero |
| Región fija con la primera que devuelve la API | Selector de región | El seed solo trae la Metropolitana y la regla es "una lista cerrada" |
| Fotos, horario y publicar quedan como avisos | Esconder esos pasos | Se ven en el flujo completo y A y C saben dónde se enchufan sus piezas |
| Proxy de Vite en vez de CORS en el back | Habilitar CORS ahora | CORS es de A (CU-05); el proxy desbloquea el desarrollo sin tocar su dominio |
| `/login` de desarrollo | Pedir poner el token a mano en la consola | Cualquiera del equipo puede probar las rutas privadas con un clic; en producción sigue el placeholder |

#### Archivos principales
- `rentsmart-front/src/features/spaces/`: `PublishSpacePage`, `SpaceWizard`, `form`, `spaces-api`, `types` y pruebas.
- `rentsmart-front/src/components/Select.tsx` y `Textarea.tsx`.
- `rentsmart-front/src/features/dev/DevLoginPage.tsx`, `src/routes.tsx`, `vite.config.ts`.
- `rentsmart-front/src/mocks/handlers.ts`.

#### Cómo probarlo
- Desde `rentsmart-front`: `npm run lint`, `npm run build` y `npm test`.
- Con el back (ver más abajo) en `localhost:3000` y `cp .env.example rentsmart-front/.env`: `npm run dev`, abrir `/publish`, entrar con el login de desarrollo y recorrer los pasos.
- Sin back: `VITE_USE_MOCKS=true npm run dev` en Chrome o Edge usa MSW.

#### Estado de verificación
- Build: ✅
- Lint: ✅
- Tests: ✅ (22 archivos, 159 pruebas)
- Navegador contra el back real: ✅ (descrito arriba). No se probó con el guard JWT de A, que no existe todavía.

#### Pendientes y bloqueos
- Depende de los PR #91 y #92 y de las ramas apiladas de BU-01 y BU-02.
- ES-03 (fotos), DI-01 de C (horario semanal) y ES-04 (publicar de verdad) completan los pasos 3, 4 y 5.
- Cuando A entregue CU-02, reemplazar la ruta `login` de `routes.tsx` y quitar `DevLoginPage`.

#### Para el resto del equipo
- **Si `docker compose up` no te conecta a la base:** en esta máquina ya había un PostgreSQL nativo escuchando en el puerto 5432, que ocupa el puerto de `db-dev`. Para la demo se usó otro contenedor en el puerto 5435 (`DATABASE_URL=postgresql://devuser:devpassword@localhost:5435/devdb`). Si te pasa lo mismo, cambia el puerto publicado en `docker-compose.yml` (solo local) o detén el PostgreSQL nativo.
- Para llamar a la API en desarrollo sin CORS, deja `VITE_API_URL=http://localhost:5173` (ya es el valor de `.env.example`).
- A (@AlejandroMG): el formulario espera que el back valide con `ValidationPipe`; los mensajes de error 400 se muestran tal cual.

---

### 2026-10-05 · B (xReNatS) · ES-03 subir y ordenar fotos (front)

**Issues:** #22 (ES-03), parte del front
**Rama / PR:** `feat/ES-03-photos-ui`, apilada sobre `feat/ES-02-wizard` · sin PR todavía
**Duración aproximada:** 1,5 h
**Herramientas:** Claude Code

#### Objetivo
Completar el paso "Fotos" del formulario de publicar: subir de 1 a 10 fotos, ordenarlas (la primera es la portada) y borrarlas, contra los endpoints de fotos del back.

#### Qué se hizo
- `PhotosStep`: botón "Agregar fotos" (selección múltiple), contador "n de 10 fotos", una tarjeta por foto con la insignia "Portada", mover a izquierda y derecha, "Hacer portada" y "Eliminar" (con confirmación en un `Modal`). Las fotos suben una a una y aparecen a medida que terminan, con un aviso de progreso.
- `photo-rules`: validación en el cliente antes de subir (JPG, PNG o WebP, hasta 5 MB y lugar para hasta 10), con un mensaje por cada archivo rechazado; `moveItem` calcula el orden nuevo. El servidor vuelve a comprobar todo.
- Con un error del servidor se muestra con el nombre del archivo y se sigue con las demás; con un 409 (espacio lleno) se deja de intentar. Si falla el orden o el borrado, la lista queda como estaba.
- El formulario guarda las fotos al momento (no con el borrador): la lista "Para publicar necesitas" marca "Al menos una foto" y el resumen del último paso cuenta las fotos. `OwnerSpace` trae `photos`, así que un borrador abierto por su dirección muestra las suyas.
- Handlers de MSW de las fotos (subir, ordenar y borrar), con imágenes de color generadas en el momento.
- 38 pruebas nuevas (197 en total). Las pruebas encontraron un error de redacción ("no se subióron") y que `instanceof File` no sirve en MSW dentro de jsdom; ambos corregidos.
- Probado de punta a punta en el navegador contra el back real: tres fotos subidas, "Hacer portada", orden guardado en la base, borrado que elimina la fila y el archivo, y las imágenes se ven (900×600) desde `/api/uploads` por el proxy.

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| Subir de a una, mostrando cada foto al terminar | Subir todas en paralelo | El servidor limita a 10 de forma segura, pero el orden de llegada y los mensajes por archivo son más claros de a una |
| Las fotos no pasan por el guardado del borrador | Incluirlas en el `PATCH` | Son archivos con su propio ciclo en el servidor (subir, ordenar, borrar) |
| Botones ← → y "Hacer portada" | Arrastrar y soltar | Funciona con teclado y en móvil sin una librería; el arrastre queda como mejora |
| Confirmar antes de eliminar | Borrar al instante | Una foto borrada no se recupera; el servidor también borra el archivo |
| Validar en el cliente y en el servidor | Solo en el servidor | Evita subir un archivo de 20 MB solo para que lo rechace |

#### Archivos principales
- `rentsmart-front/src/features/spaces/`: `PhotosStep`, `photo-rules`, `spaces-api` y `types`, con sus pruebas.
- `rentsmart-front/src/mocks/handlers.ts`.

#### Cómo probarlo
- Desde `rentsmart-front`: `npm run lint`, `npm run build` y `npm test`.
- Con el back de ES-03 en `localhost:3000`: `npm run dev`, entrar con el login de desarrollo, crear un borrador y abrir el paso 4.

#### Estado de verificación
- Build: ✅
- Lint: ✅
- Tests: ✅ (24 archivos, 197 pruebas)
- Navegador contra el back real: ✅ (descrito arriba).

#### Pendientes y bloqueos
- Depende del back de ES-03 (rama `feat/ES-03-photos-api`) y de la cadena de ramas anteriores.
- Arrastrar y soltar para ordenar (mejora).
- ES-04 (publicar de verdad) y el horario semanal (DI-01 de C) completan el flujo.

#### Para el resto del equipo
- Las fotos locales se ven bajo `/api/uploads`; con Supabase la `url` ya viene absoluta.

---

### 2026-10-05 · B (xReNatS) · ES-04 publicar desde el formulario (front)

**Issues:** #23 (ES-04), parte del front
**Rama / PR:** `feat/ES-04-publish-ui`, apilada sobre `feat/ES-03-photos-ui` · sin PR todavía
**Duración aproximada:** 1,5 h
**Herramientas:** Claude Code

#### Objetivo
Conectar el botón "Publicar espacio" del último paso con `POST /api/spaces/:id/publish`, mostrar exactamente qué falta cuando el back responde 409 y reflejar la regla nueva P-18 (tipo y comuna obligatorios).

#### Qué se hizo
- La lista "Para publicar necesitas" ahora tiene los 7 requisitos con los mismos códigos que el back (tipo, descripción, capacidad, comuna, precio, foto y horario), cada uno con el paso donde se completa (`REQUIREMENTS` en `form.ts`).
- "Publicar espacio" guarda lo pendiente y pide publicar. Si el back responde 409 con `missing`, se muestra "Aún no puedes publicar. Te falta:" con un enlace "Ir al paso N" por cada cosa; el horario semanal se avisa "(se podrá cargar pronto)" sin enlace, porque DI-01 todavía no existe. El aviso desaparece al volver a guardar.
- Si se publica, la pantalla cambia a "¡Tu espacio está publicado!" con enlaces a la ficha en el catálogo, a Mis espacios y a publicar otro.
- Un borrador abierto que ya está publicado, desactivado o bloqueado se edita ("Edita tu espacio", "Cambios guardados") y no ofrece publicar: explica en qué estado está.
- `missingFromError` lee `missing` de un `ApiError`; `publishSpace` y `changeSpaceStatus` en `spaces-api.ts` (el segundo lo usará el panel PN-01).
- Handlers de MSW de publicar y cambiar estado, con las mismas reglas del back (el horario se da por cargado en la simulación).
- 21 pruebas nuevas (218 en total).
- Probado de punta a punta en el navegador contra el back real: con todo completo menos el horario, el back responde 409 y la pantalla dice "Horario semanal (se podrá cargar pronto)"; al insertar un horario a mano en la base, publica, el espacio sale primero en el catálogo público con su portada y horario, y la cuenta queda como propietaria.

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| El botón está siempre disponible y el back dice qué falta | Desactivarlo hasta que la lista esté completa | La lista del cliente no conoce el horario; confiar en la respuesta del back evita duplicar la regla y muestra lo que realmente falta |
| Sin enlace para el horario | Enlazar al paso 3 | Ese paso solo tiene un aviso hasta que DI-01 exista; un enlace que no lleva a nada confunde |
| Los espacios publicados se editan en el mismo formulario | Pantalla de edición aparte (ES-05) | Es el mismo formulario; el back ya impide dejar incompleto un espacio activo |

#### Archivos principales
- `rentsmart-front/src/features/spaces/`: `SpaceWizard`, `form`, `spaces-api` y pruebas.
- `rentsmart-front/src/mocks/handlers.ts`.

#### Cómo probarlo
- Desde `rentsmart-front`: `npm run lint`, `npm run build` y `npm test`.
- Con el back de ES-04 en `localhost:3000`: completar un borrador hasta el último paso y pulsar "Publicar espacio".

#### Estado de verificación
- Build: ✅
- Lint: ✅
- Tests: ✅ (24 archivos, 218 pruebas)
- Navegador contra el back real: ✅ (descrito arriba).

#### Pendientes y bloqueos
- Sin el horario semanal (DI-01 de C) un espacio nuevo no se puede publicar de verdad.
- Panel "Mis espacios" con el interruptor activar/desactivar (PN-01 y ES-06 front).

#### Para el resto del equipo
- Los códigos de `missing` (`type`, `description`, `capacity`, `commune`, `price`, `photos`, `schedule`) son parte del contrato con el back.

---

### 2026-10-06 · B (xReNatS) · Revisión de #93 y #94 y subida de las ramas en 3 PR

**Issues:** #27, #28 (BU-01, BU-02), #21, #22, #23, #25 (ES-02 a ES-06) y #48 (PN-01, solo la API)
**Rama / PR:** `feat/BU-01-ES-04-front` (este PR, el del front), `feat/BU-01-catalog-api` y `feat/ES-02-ES-06-spaces-api` (los dos del back)
**Duración aproximada:** 1 h
**Herramientas:** Claude Code

#### Objetivo
Revisar los PR de A (#93 registro y #94 login) y subir mi trabajo, que estaba en 11 ramas apiladas, en tres PR para que C pueda revisarlo antes del viernes 9.

#### Qué se hizo
- Revisión de #93 (CU-01) y #94 (CU-02): aprobados. Observaciones en #94: el `JWT_SECRET` de `.env.example` es un valor válido, el token aún no se usa en la API (falta CU-03) y `RequireAuth` no reacciona al vencer el token.
- Las 11 ramas apiladas se reunieron en tres PR contra `main`: back del catálogo (BU-01 y BU-02), back de espacios (ES-02 a ES-06 y la API de PN-01) y el front completo (catálogo, detalle, formulario con fotos y publicar).
- Se trajo `main` (los merges de #91 y #92) a las tres ramas. Solo hubo conflicto en esta bitácora: se dejó la versión de `main` y se agregaron las entradas de cada rama.
- Vitest: `testTimeout` de 15 s. Los tests del formulario por pasos usan `userEvent` y en un runner lento pasaban de los 5 s por defecto (falló una vez bajo carga).

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| Tres PR grandes | Once PR chicos en cadena | El plazo es el 9 y cada PR en cadena espera la revisión del anterior; el CI solo corre sobre PR hacia `main`. Se pierde la regla de menos de 400 líneas, pero se conserva un commit por historia |
| PR independientes entre sí | Apilar el de espacios sobre el del catálogo | Cada uno se puede mergear solo; el segundo en entrar resuelve un conflicto trivial en `app.module.ts` y en la bitácora |

#### Cómo probarlo
Back: `docker compose up -d db-test`, `npx prisma migrate deploy`, y en `rentsmart-back` (Node 24) `npm run lint`, `npm test`, `npm run test:e2e` y `npm run build`. Front: en `rentsmart-front`, `npm run lint`, `npm test` y `npm run build`.

#### Estado de verificación
- Back catálogo: lint ✅ · 20 unitarias ✅ · 29 e2e ✅ · build ✅
- Back espacios: lint ✅ · 109 unitarias ✅ · 97 e2e ✅ · build ✅
- Front: lint ✅ · 218 tests (24 archivos) ✅ · build ✅

#### Pendientes y bloqueos
- Cuando entren #93 y #94: usar el login de A y retirar `DevLoginPage`, y agregar `JWT_SECRET` al `.env` local. El guard temporal se cambia por `JwtAuthGuard` con CU-03.
- Sin `<HorarioSemanal>` (DI-01, de C) no se puede publicar un espacio nuevo desde la app: el horario se carga a mano en la BD.
- Falta el front del panel "Mis espacios" (PN-01), BU-03 (filtros) y probar el almacenamiento en Supabase con credenciales reales.

#### Para el resto del equipo
- C (@gonzzza-lol): son tres PR grandes; el orden sugerido de revisión es catálogo (back), espacios (back) y front. El front reserva el espacio de `<BookingWidget>` en el detalle y el del horario en el formulario.
- A (@AlejandroMG): con #94 el back exige `JWT_SECRET`, así que los `.env` locales dejan de arrancar hasta agregarlo.

---

### 2026-10-06 · B (xReNatS) · PN-01 y ES-06 panel "Mis espacios" (front)

**Issues:** #48 (PN-01, parte del front), #25 (ES-06, el interruptor), #24 (ES-05, el acceso a editar)
**Rama / PR:** `feat/PN-01-mis-espacios`, apilada sobre `feat/BU-01-ES-04-front` (#98) · sin PR todavía
**Duración aproximada:** 1 h
**Herramientas:** Claude Code

#### Objetivo
Que el propietario vea sus espacios con el estado de cada uno y lo que le falta, y pueda editarlos y activarlos o desactivarlos, según el panel del prototipo aprobado.

#### Qué se hizo
- `/owner/spaces` deja de ser un placeholder: lee `GET /api/spaces/me` y muestra, por espacio, la portada, el estado (Activo, Inactivo, Borrador o Bloqueado), tipo, comuna, precio y "Falta: foto, precio y horario". Arriba, tres contadores por estado (un cuarto, de bloqueados, solo si hay).
- Interruptor activar o desactivar con `PATCH /api/spaces/:id/status`. **Desactivar pide confirmación** (sale del catálogo y no recibe nuevas reservas; las confirmadas se mantienen, como dice `producto.md`); activar no. Si el back rechaza la activación con `missing[]`, el aviso dice qué falta. El estado se actualiza con lo que responde el servidor, sin recargar la lista.
- Accesos a editar: "Editar" (publicados e inactivos) y "Completar" (borradores) abren el formulario `/publish/:id`. Los borradores no tienen interruptor (se publican desde el formulario) y los bloqueados por el administrador no tienen ningún acceso.
- Estados de carga, error con reintento y vacío (invita a publicar el primero). A 375 px los contadores van en una fila y no hay scroll horizontal.
- Mock de MSW para `GET /api/spaces/me` con la misma forma que el contrato. Las listas de tipos y comunas de los mocks se extrajeron a constantes para reutilizarlas.
- Pruebas: 28 nuevas (helpers de texto, la página con sus estados y flujos, y el mock). Quedan 246 en 26 archivos.

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| Confirmar al desactivar, no al activar | Confirmar siempre, o nunca | Desactivar saca la publicación del catálogo; activar es reversible y no tiene riesgo |
| El interruptor tiene nombre fijo ("Publicación de X") y el estado va en `aria-checked` | Cambiar el nombre a "Activar X" o "Desactivar X" | Es la práctica de accesibilidad para `role="switch"`; el estado no debe cambiar su nombre |
| "Próximas reservas" como aviso fijo | Mostrar datos de ejemplo | Las reservas son del equipo de C (RE-02 a RE-04) y hoy no existen; el prototipo lo marcaba para después del 9 |
| Actualizar la lista con la respuesta del `PATCH` | Recargar `GET /api/spaces/me` | Evita el parpadeo y que la fila cambie de lugar al modificarse |

#### Archivos principales
- `rentsmart-front/src/features/owner/`: `OwnerSpacesPage`, `OwnerSpaceRow`, `owner-api`, `summary`, `types` y sus pruebas.
- `rentsmart-front/src/mocks/handlers.ts` y `handlers.test.ts`.

#### Cómo probarlo
En `rentsmart-front`: `npm run lint`, `npm test` y `npm run build`. A mano, con el back (tras mergear #96 y #97) y el seed: entrar por `/login` y abrir `/owner/spaces`; desactivar un espacio, volver a activarlo, e intentar activar uno del seed (sin foto) para ver el aviso de lo que falta.

#### Estado de verificación
- Lint: ✅
- Tests: ✅ (26 archivos, 246 pruebas)
- Build: ✅
- A mano, contra el back real con el seed: lista, borrador, desactivar con confirmación, reactivar y rechazo por falta de foto ✅. A 375 px y en escritorio ✅

#### Pendientes y bloqueos
- Próximas reservas de cada espacio (PN-01) y reservas por estado (PN-02): dependen de C.
- ES-05: falta el test de que un cambio de precio no altera las reservas existentes; depende de las reservas de C.
- Los espacios del seed están `ACTIVE` sin foto, así que desactivarlos y reactivarlos da el aviso de que falta la foto.

#### Para el resto del equipo
- C (@gonzzza-lol): el panel deja un bloque "Próximas reservas" para listar las de los espacios del usuario cuando existan; avísame el contrato.

---

### 2026-10-06 · B (xReNatS) · BU-03 filtros y búsqueda del catálogo (front)

**Issues:** #29 (BU-03), parte del front
**Rama / PR:** `feat/BU-03-catalog-filters`, apilada sobre `feat/BU-01-ES-04-front` (#98) · sin PR todavía
**Duración aproximada:** 1,5 h
**Herramientas:** Claude Code

#### Objetivo
Dar al catálogo el buscador y los filtros del prototipo aprobado, con la búsqueda guardada en la URL para poder compartirla.

#### Qué se hizo
- Franja superior del prototipo con el buscador por texto ("Busca por nombre, tipo o comuna"). La búsqueda se aplica al enviar (Enter o "Buscar"), no en cada tecla.
- Un chip por tipo de espacio (con "Todos") y selectores de comuna y capacidad mínima. El precio tiene un selector "Por hora / Por día" y los selectores "Precio mínimo" y "Precio máximo", cada unidad con sus propias opciones. Las opciones que dejarían el rango al revés están deshabilitadas y, al cambiar de unidad, el precio se reinicia (las escalas no se parecen). Cada cambio se aplica al instante. "Limpiar filtros" aparece cuando hay alguno; la unidad sola no cuenta como filtro.
- **La URL es la fuente de verdad**: `?q=sala&typeId=3&communeId=2&minCapacity=8&priceUnit=day&minPrice=30000&maxPrice=80000&page=2`. Se puede recargar, compartir y volver atrás. Un valor inválido o fuera de rango se ignora en vez de provocar un 400 de la API; si el valor de la URL no es una de las opciones del selector, igual se muestra. Cambiar un filtro vuelve a la página 1 y los enlaces de la paginación conservan los filtros.
- Sin resultados: "No encontramos espacios con esos filtros" con un botón para limpiarlos. Si no cargan los tipos y las comunas, el catálogo y el buscador siguen funcionando.
- El mock del catálogo filtra con las mismas reglas que el back. `SPACE_TYPES` y `COMMUNES` se extraen a constantes (igual que en el PR del panel, #99).
- A 375 px el buscador ocupa todo el ancho con el botón debajo, y los chips y selectores se envuelven sin scroll horizontal.
- Pruebas nuevas de la lógica de la URL y de la página con todos sus flujos. En esta rama, con Node 24, hay 324 en 28 archivos (incluye el panel y el login de A).

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| Precio con unidad (por hora o por día) y selectores desde y hasta | Solo "Hasta $X / hora", como en el prototipo | Lo decidió Renato el 06-10: cumple "rango de precio" y deja encontrar los espacios que solo se arriendan por día. Se aparta un poco del prototipo, que traía solo el máximo por hora |
| El texto se envía al apretar Enter o "Buscar" | Buscar mientras se escribe | Evita pedir resultados a medias y no llena el historial con una entrada por tecla |
| Los tipos y las comunas se leen de la API que ya usa el formulario | Listas fijas en el código | Si el administrador agrega un tipo, aparece solo |

#### Archivos principales
- `rentsmart-front/src/features/catalog/`: `CatalogPage`, `FilterBar`, `SearchBox`, `filters`, `catalog-api`, `useCatalog` y sus pruebas.
- `rentsmart-front/src/mocks/handlers.ts`, `src/components/icons.tsx` y `src/routes.test.tsx`.

#### Cómo probarlo
En `rentsmart-front` (Node 24): `npm run lint`, `npm test` y `npm run build`. A mano, con el back de #96 y la rama de filtros del back: abrir `/`, elegir un tipo, una comuna, buscar un texto, y recargar o copiar la URL.

#### Estado de verificación
- Lint: ✅
- Tests: ✅ (28 archivos, 324 pruebas, con Node 24)
- Build: ✅
- A mano, contra el back real con el seed: chips, selectores, búsqueda con tildes, enlace compartido y 375 px ✅

#### Pendientes y bloqueos
- El orden de los resultados (BU-04) y el filtro por disponibilidad (BU-05) quedan para después del 9 de octubre.
- Las opciones de precio son fijas por unidad (por hora hasta $30.000, por día hasta $200.000). Si el catálogo crece con otros precios habrá que revisarlas.

#### Para el resto del equipo
- C (@gonzzza-lol): cuando exista la disponibilidad, el filtro BU-05 irá junto a estos en `FilterBar`.

---

### 2026-10-05 · B (xReNatS) · BU-01 y BU-02 catálogo público (back)

**Issues:** #27 (BU-01) y #28 (BU-02), parte del back
**Rama / PR:** `feat/BU-01-catalog-api`, apilada sobre `feat/ES-01-space-types` (PR #92) · sin PR todavía
**Duración aproximada:** 1,5 h
**Herramientas:** Claude Code

#### Objetivo
Implementar los endpoints públicos que consume el front del catálogo, con la forma de respuesta que ya usa el front (`GET /api/catalog` paginado) y el detalle de un espacio.

#### Qué se hizo
- Módulo `catalog`: `GET /api/catalog?page=&pageSize=` (solo espacios activos, más recientes primero, `{ items, total, page, pageSize }`) y `GET /api/catalog/:id` (detalle público con equipamiento, fotos por posición y horario semanal; 404 si no existe o no está activo).
- Validación de la consulta con un DTO: `page` ≥ 1 y `pageSize` de 1 a 50; un valor inválido o un parámetro desconocido da 400.
- Privacidad (P-09): el `select` de Prisma es una lista blanca; `addressDetail`, `ownerId` y `status` nunca salen por la API.
- Pruebas: 8 unitarias del servicio y 20 e2e contra la base de test. Una prueba rompe a propósito el filtro y la lista blanca para comprobar que los tests lo detectan (se hizo a mano y se restauró).
- Documentación de los endpoints en `docs/arquitectura.md`.

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| Una sola consulta transaccional para la página y el total | Dos consultas sueltas | El total y los items salen del mismo instante |
| Orden `createdAt desc` con desempate por `id` | Solo `createdAt` | Con fechas iguales (seed) la paginación podía repetir o saltar espacios |
| `select` explícito en lugar de excluir campos | Traer todo y borrar `addressDetail` | Si se agrega un campo privado al schema, no queda expuesto por accidente |
| `typeName` y `communeName` vacíos si faltan | Descartar el espacio | El schema los deja opcionales, pero un espacio activo ya pasó las reglas de publicación (ES-04) |
| El detalle usa `:id` sin validar el formato | `ParseUUIDPipe` | Los espacios del seed tienen ids como `seed-space-1`; un id inexistente da 404 igual |
| Los e2e dan fechas de creación lejanas a sus espacios | Depender del orden de inserción | El orden queda fijo y los espacios no activos tienen fechas aún más nuevas, así que un filtro roto los haría aparecer arriba |

#### Archivos principales
- `rentsmart-back/src/catalog/`: módulo, controlador, servicio, DTOs y prueba unitaria.
- `rentsmart-back/test/catalog.e2e-spec.ts` y `test/app.e2e-spec.ts` (Swagger lista los endpoints nuevos).
- `docs/arquitectura.md`.

#### Cómo probarlo
- Con `docker compose up -d db-test`: en `rentsmart-back`, `npm run lint`, `npm run build`, `npm test` y `npm run test:e2e` (Node 24).
- `npm run seed` y `npm run start:dev`: `GET http://localhost:3000/api/catalog` devuelve los 10 espacios del seed y `GET /api/catalog/seed-space-1` su detalle; Swagger en `/docs`.

#### Estado de verificación
- Build: ✅
- Lint: ✅
- Tests unitarios: ✅ (5 archivos, 20 pruebas)
- Tests e2e: ✅ (3 archivos, 29 pruebas)

#### Pendientes y bloqueos
- Depende de que se mergee el PR #92 (ES-01 y base de la API).
- BU-03 (filtros y búsqueda) y BU-04 (orden) se agregan como parámetros de este mismo endpoint.
- El front del detalle (BU-02) sigue pendiente; ya existe el contrato.

#### Para el resto del equipo
- C: el detalle público trae `schedule` (el horario semanal) y el `id` que necesita `<BookingWidget spaceId>`. La disponibilidad real (bloques libres) sigue siendo `GET /api/spaces/:id/availability` (DI-02).
- Cualquier endpoint público nuevo debe usar `select` explícito y tener un test que compruebe que no filtra `addressDetail`.

---

### 2026-10-06 · B (xReNatS) · BU-03 filtros y búsqueda del catálogo (back)

**Issues:** #29 (BU-03), parte del back
**Rama / PR:** `feat/BU-03-catalog-filters-api`, apilada sobre `feat/BU-01-catalog-api` (#96) · sin PR todavía
**Duración aproximada:** 1 h
**Herramientas:** Claude Code

#### Objetivo
Que `GET /api/catalog` filtre por tipo, comuna, capacidad mínima, rango de precio y texto libre, para que el front deje la búsqueda en la URL.

#### Qué se hizo
- Parámetros opcionales y combinables de `GET /api/catalog`: `typeId`, `communeId`, `minCapacity`, `minPrice`, `maxPrice`, `priceUnit` y `q`. Todos deben cumplirse y `total` cuenta solo los que cumplen, así la paginación sigue bien.
- Validan con `class-validator` y topes (los mismos que al publicar): un valor inválido o enorme da 400, no un 500 por desbordar el `Int` de Postgres. Un precio mínimo mayor que el máximo da 400 con mensaje.
- `q` usa hasta 5 palabras y cada una debe aparecer en el nombre, la descripción, el tipo o la comuna, sin distinguir mayúsculas. **No busca en la dirección ni en su detalle**: así la búsqueda no sirve para averiguar el detalle privado (P-09). Hay un e2e que lo comprueba.
- `contains` de Prisma no escapa los comodines de LIKE: buscar `%` listaba todo. Ahora se escapan `%`, `_` y la barra invertida (lo descubrió el e2e).
- Swagger describe cada parámetro y la respuesta 400. `docs/arquitectura.md` documenta el contrato.
- `priceUnit` (`hour` por defecto o `day`) elige si `minPrice` y `maxPrice` se aplican al precio por hora o por día (decidido con Renato el 06-10).
- Pruebas nuevas unitarias y e2e. En esta rama, con Node 24, hay 54 unitarias y 88 e2e en total.

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| `priceUnit` (`hour` o `day`) elige a qué precio se aplican `minPrice` y `maxPrice` | Aceptar cualquiera de los dos precios, o filtrar solo por hora | Los dos precios están en escalas distintas (miles contra decenas de miles) y mezclarlos confunde. Un espacio que no se arrienda en esa unidad queda fuera de un filtro de precio. Lo decidió Renato el 06-10 |
| Cada palabra de `q` en cualquiera de cuatro campos | Una sola frase exacta, o también buscar en la dirección | Con "sala providencia" se encuentra una sala en Providencia. La dirección y su detalle quedan fuera por privacidad |
| No ignora las tildes ("camara" no encuentra "Cámara") | Extensión `unaccent` de Postgres | Exigiría una migración, y el esquema es de A. Se puede ver después |

#### Archivos principales
- `rentsmart-back/src/catalog/`: `dto/list-catalog-query.dto`, `catalog.service`, `catalog.controller` y `catalog.service.spec`.
- `rentsmart-back/test/catalog-filters.e2e-spec.ts`.
- `docs/arquitectura.md`.

#### Cómo probarlo
Con una BD de test migrada, en `rentsmart-back` (Node 24): `npm run lint`, `npm test`, `npm run test:e2e` y `npm run build`. A mano, con el seed: `GET /api/catalog?typeId=1&maxPrice=14000&q=sala` en Swagger (http://localhost:3000/docs).

#### Estado de verificación
- Lint: ✅
- Tests unitarios: ✅ (6 archivos, 54 pruebas)
- Tests e2e: ✅ (6 archivos, 88 pruebas)
- Build: ✅

#### Pendientes y bloqueos
- El orden de los resultados (BU-04) queda para después del 9 de octubre.
- Filtrar por disponibilidad (BU-05) depende de las reservas de C.

#### Para el resto del equipo
- A (@AlejandroMG): no toca `schema.prisma`. Una búsqueda sin tildes (`unaccent`) requeriría una migración suya, si se quiere.

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

### 2026-10-06 · B (xReNatS) · BU-04 ordenar resultados del catálogo

**Issues:** #30 (BU-04)
**Rama / PR:** `feat/BU-04-ordenar-resultados` · sin PR todavía
**Duración aproximada:** 1 h
**Herramientas:** Claude Code

#### Objetivo
Que el catálogo se pueda ordenar por precio y por los más recientes, y que el orden quede en la URL junto a los filtros.

#### Qué se hizo
- **API:** `GET /api/catalog?sort=` con `recent` (por defecto), `price_asc` y `price_desc`; otro valor da 400. El precio es el de `priceUnit` (por hora, o por día) y los espacios que no se arriendan en esa unidad van **al final en las dos direcciones**. Siempre se desempata por fecha y por id, así la paginación es estable aunque haya precios iguales. El orden no cambia qué espacios salen ni el total.
- **Front:** selector "Ordenar por" junto al contador de resultados, con "Más recientes", "Precio por hora: menor a mayor" y "Precio por hora: mayor a menor" (dice "por día" si la unidad del precio es el día). El orden vive en la URL (`?sort=price_asc`), no cuenta como filtro, sobrevive a "Limpiar filtros", y los enlaces de la paginación lo conservan. Cambiarlo vuelve a la página 1. El mock ordena igual que el back.
- Un test encontró un defecto antes de subir: el front solo mandaba `priceUnit` junto con un rango de precio, así que ordenar por precio por día sin rango ordenaba por hora. Ahora la unidad también viaja cuando se ordena por precio.
- Pruebas: 6 unitarias y 14 e2e nuevas en el back (157 y 190 en total), y 19 en el front (343 en 28 archivos), todas con Node 24.

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| El orden por precio sigue la unidad del filtro de precio (hora o día) | Un orden aparte por cada unidad | Ya hay un selector de unidad; así no se agrega otro control y el precio que se ordena es el mismo que se filtra |
| Los espacios sin precio en esa unidad van al final en las dos direcciones | Primero al ordenar de mayor a menor | Un espacio sin precio por hora no es el más caro; en `price_desc` aparecería arriba y confundiría |
| "Mejor calificados" no se implementa todavía | Un orden falso o desactivado | No existen reseñas ni calificación (A, después del 9 de octubre). Queda pendiente en #30 |

#### Archivos principales
- Back: `rentsmart-back/src/catalog/` (`dto/list-catalog-query.dto`, `catalog.service` y su spec) y `test/catalog-sort.e2e-spec.ts`.
- Front: `rentsmart-front/src/features/catalog/` (`SortSelect`, `CatalogPage`, `filters`, `catalog-api` y sus pruebas) y `src/mocks/handlers.ts`.
- `docs/arquitectura.md`.

#### Cómo probarlo
Back (Node 24, `JWT_SECRET` y BD de test migrada): `npm run lint`, `npm test`, `npm run test:e2e` y `npm run build`. Front: `npm run lint`, `npm test` y `npm run build`. A mano, con el seed: abrir `/`, elegir "Precio por hora: menor a mayor", cambiar a "Por día" y comprobar que el orden sigue al precio por día.

#### Estado de verificación
- Back: lint ✅ · 157 unitarias ✅ · 190 e2e ✅ · build ✅
- Front: lint ✅ · 343 tests (28 archivos) ✅ · build ✅
- A mano, contra el back real con el seed: orden por hora y por día, nulos al final, 400 con un orden inválido y 375 px sin desbordes ✅

#### Pendientes y bloqueos
- Ordenar por calificación depende de las reseñas (A). Cuando existan, se agrega `rating` a `sort` y una opción al selector.
- Hay un error de tipos que ya estaba en `main`, en `rentsmart-back/src/spaces/spaces.service.spec.ts` (línea 125): `tsc` lo marca, pero ni el lint ni los tests ni el build lo ven.

#### Para el resto del equipo
- A (@AlejandroMG): cuando exista la calificación de los espacios (reseñas), avísame para agregar el orden "mejor calificados".

---

### 2026-10-06 · B (xReNatS) · ES-07 API: punto del espacio en el mapa

**Issues:** #26 (ES-07)
**Rama / PR:** `feat/ES-07-mapa-api` · sin PR todavía (el front está en `feat/ES-07-mapa-front`, un PR aparte)
**Duración aproximada:** 1 h
**Herramientas:** Claude Code

#### Objetivo
Que el propietario pueda guardar el punto de su espacio en el mapa y que el detalle público entregue solo una zona aproximada. El issue no tenía criterios ("por definir al tomar la historia"): los definí con Renato y quedaron en P-19.

#### Qué se hizo
- **Base de datos:** `Space` agrega `latitude` y `longitude` (`Float?`) con la migración `20261006180000_space_coordinates`, que además crea un `CHECK` para que vayan juntas (las dos o ninguna). Con la migración aplicada, el esquema y la BD no tienen diferencias.
- **API del propietario:** `POST` y `PATCH /api/spaces` aceptan `latitude` y `longitude`: opcionales, dentro de Chile (latitud de -56 a -17, longitud de -110 a -66, hasta 6 decimales) y siempre juntas (400 si llega una sola, también contando el valor ya guardado). `null` en las dos borra el punto. El dueño recibe el punto exacto en `GET /api/spaces/:id`.
- **API pública:** `GET /api/catalog/:id` agrega `location: { latitude, longitude, radiusMeters } | null` con las coordenadas **redondeadas a 3 decimales** y un radio de 150 m. El punto exacto no sale de la API pública y la lista del catálogo no trae coordenadas. El redondeo está en `src/catalog/approximate-location.ts`; un test recorre Chile en una grilla y comprueba que el punto real queda siempre dentro del círculo (el peor caso está a unos 77 m).
- **Pruebas:** 168 unitarias y 193 e2e. Las e2e comprueban el flujo completo (marcar, mover, borrar, rechazos) y que el punto exacto no aparece en ninguna parte del detalle público ni de la lista.

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| El propietario marca el punto en un mapa | Geocodificar la dirección con Nominatim; usar solo el centro de la comuna | No depende de un servicio externo con límite de uso ni de que encuentre la dirección, y el punto queda donde el propietario dice. El centro de la comuna pondría todos los espacios de una comuna en el mismo lugar |
| El público ve un círculo de ~150 m, con coordenadas redondeadas en la API | Mostrar el pin exacto | El issue pide una ubicación "aproximada"; redondear en la API (y no solo dibujar un círculo en el front) hace que el punto exacto no salga nunca del servidor. La dirección escrita sigue siendo pública (P-09) |
| `latitude` y `longitude` van juntas, validado en el servicio y con un `CHECK` en la BD | Solo validar en el servicio | Un punto con una sola coordenada no sirve para nada; así ninguna ruta de código puede dejarlo a medias |
| Dentro de Chile, por una caja de latitud y longitud | Validar contra la comuna elegida | Descarta los errores groseros (signo cambiado, coordenadas de otro país) sin necesitar coordenadas por comuna, que no existen en el seed |

#### Archivos principales
- `rentsmart-back/prisma/schema.prisma` y `prisma/migrations/20261006180000_space_coordinates/`: las dos columnas y el `CHECK`.
- `rentsmart-back/src/spaces/` (`dto/create-space.dto.ts`, `dto/space.dto.ts`, `spaces.service.ts`) y `src/catalog/` (`approximate-location.ts`, `dto/catalog-detail.dto.ts`, `catalog.service.ts`).
- `rentsmart-back/test/space-location.e2e-spec.ts`: el flujo completo y que el punto exacto no sale en lo público.
- `docs/decisiones.md` (P-19) y `docs/arquitectura.md`.

#### Cómo probarlo
Con Node 24, en `rentsmart-back`: aplicar la migración (`npx prisma migrate deploy`) y correr `npm run lint`, `npm run build`, `npm test` y `npm run test:e2e`. A mano en Swagger: `PATCH /api/spaces/:id` con `latitude: -33.4489` y `longitude: -70.6693`; activar el espacio y abrir `GET /api/catalog/:id`: `location` trae `-33.449`, `-70.669` y `radiusMeters: 150`.

#### Estado de verificación
- Lint: ✅ · Build: ✅ · 168 unitarias ✅ · 193 e2e ✅ (Node 24, BD de test migrada y sin seed, como en el CI)

#### Pendientes y bloqueos
- **Cambio de `schema.prisma`:** este PR necesita la revisión de A (@AlejandroMG), además de la de C.
- **Orden de merge:** va antes que el PR del front. El formulario del front manda `latitude` y `longitude`, y una API sin este PR las rechaza con 400 (`forbidNonWhitelisted`).
- Las teselas públicas de OpenStreetMap sirven para el MVP; con tráfico real hay que cambiar `TILE_URL` (en el front) por un proveedor propio.

#### Para el resto del equipo
- A (@AlejandroMG): este PR cambia `schema.prisma` (dos columnas nuevas en `Space` y una migración con un `CHECK`). Por favor revísalo.
- C (@gonzzza-lol): nada cambia en tu dominio. Si más adelante la reserva confirmada muestra la dirección completa, el punto exacto del propietario (`latitude` y `longitude`) está en la base de datos por si sirve.

---

### 2026-10-07 · B (xReNatS) · PN-02 y PN-04 API: reservas y métricas del propietario

**Issues:** #49 (PN-02), #51 (PN-04)
**Rama / PR:** `feat/PN-02-PN-04-owner-api` · sin PR todavía (el front irá en otro PR)
**Duración aproximada:** 1 h 30 min
**Herramientas:** Claude Code

#### Objetivo
Darle al panel del propietario las reservas de sus espacios (con el contacto del arrendatario en las confirmadas) y sus métricas del mes (ingresos y ocupación por espacio). #49 depende de RE-04 y #51 de las reservas, pero la tabla `Booking` ya existe en el schema, así que las dos historias se pueden hacer leyéndola, sin esperar la API de reservas de C.

#### Qué se hizo
- **`GET /api/owner/bookings`:** las reservas de todos mis espacios, paginadas, con filtros por estado y por fecha de inicio, y orden. El contacto del arrendatario (`email`, `phone`) solo viene en las confirmadas.
- **`GET /api/owner/metrics?month=`:** ingresos del mes y, por espacio, reservas, horas reservadas, horas arrendables y ocupación. Cuentan las reservas confirmadas y finalizadas que empiezan en el mes.
- **Hora de Chile:** `src/common/santiago-time.ts` calcula el comienzo de un día y de un mes en `America/Santiago`, incluido el cambio de horario de verano (septiembre dura 719 h). Sin esto, la reserva del 31 de octubre a las 23:00 de Chile caería en noviembre.
- **Módulo nuevo `owner`**, dentro del dominio de B (panel del propietario). Solo lee: no crea ni cambia reservas.
- **Pruebas:** unitarias de la hora de Chile y de las métricas (la ocupación no pasa de 1, tramos que se suman, sin espacios) y 38 e2e (estados, fechas en hora de Chile, contacto solo en confirmadas, nunca las reservas de otro propietario, meses límite, parámetros inválidos).

#### Decisiones y por qué
| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| Leer `Booking` directamente | Esperar los endpoints de reservas de C | La tabla y sus estados ya están en el schema; el panel es de B y el listado por propietario no está en ninguna historia de C. Solo lee, así que no pisa la lógica de reservas |
| El ingreso es `subtotal` | `total` | Según P-13 la comisión (10 %) se suma al arrendatario: lo que recibe el propietario es el subtotal |
| Cuentan `CONFIRMED` y `FINISHED` | También `PAID` o `PENDING` | Una reserva pagada pero todavía sin validar, o una pendiente, puede cancelarse; no es un ingreso seguro |
| Una reserva es del mes en que **empieza** | Repartirla entre meses si cruza el límite | Es lo simple y lo esperable para un panel; una reserva que cruza la medianoche del último día es rara |
| El contacto solo en reservas confirmadas | En todas | Igual que el detalle de la dirección (P-09): los datos personales se entregan cuando hay una reserva firme |
| Días y meses en hora de Chile | UTC | El propietario piensa en días de Chile; en UTC la reserva de la noche del último día del mes cae en el mes siguiente |
| Ocupación = horas reservadas sobre horas arrendables, con tope en 1 | Sin tope | Una reserva "por día" puede durar más que el horario del día; el tope evita un 130 % |

#### Archivos principales
- `rentsmart-back/src/owner/` (`owner.module.ts`, `owner.controller.ts`, `owner-bookings.service.ts`, `owner-metrics.service.ts` y `dto/`).
- `rentsmart-back/src/common/santiago-time.ts`, `src/app.module.ts` y `test/owner-panel.e2e-spec.ts`.
- `docs/arquitectura.md`.

#### Cómo probarlo
Con Node 24, en `rentsmart-back`: `npm run lint`, `npm run build`, `npm test` y `npm run test:e2e`. A mano en Swagger (sección "Panel del propietario"): crear una reserva confirmada en la base de datos y abrir `GET /api/owner/bookings` y `GET /api/owner/metrics`.

#### Estado de verificación
- Lint: ✅ · Build: ✅ · 194 unitarias ✅ · 245 e2e ✅ (Node 24, BD de test migrada y sin seed, como en el CI)

#### Pendientes y bloqueos
- Cuando C entregue RE-02 a RE-04, conviene sumar una prueba que cree las reservas por la API y no por la base de datos.
- Reemplazar el `DevAuthGuard` por el `JwtAuthGuard` de A (CU-03), igual que en `spaces`.

#### Para el resto del equipo
- C (@gonzzza-lol): este módulo lee `Booking` (`startAt`, `endAt`, `unit`, `subtotal`, `status`) y los datos del arrendatario. Si cambias esas columnas o el significado de un estado, avísame; y los estados `CONFIRMED` y `FINISHED` son los que cuentan como ingreso. Las reservas deben guardar `subtotal` sin la comisión.
- A (@AlejandroMG): no toca `schema.prisma`.

---
