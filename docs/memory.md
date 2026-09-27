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
