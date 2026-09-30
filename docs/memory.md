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

---
