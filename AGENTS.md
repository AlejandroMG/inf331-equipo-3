# AGENTS.md: RentSmart

Guía para agentes de IA (Claude Code, Copilot, Cursor, Codex u otros) y para personas que trabajen en este repositorio. Léela completa antes de hacer cambios.

## Qué es el proyecto

RentSmart es una aplicación web para arrendar espacios entre particulares por hora o por día (salas de reuniones, estudios, cocinas, canchas, etc.). Un propietario publica sus espacios; un arrendatario los busca, reserva y paga en línea con Stripe (modo test). La IA genera la descripción de los espacios a partir de fotos y datos.

- Ramo: INF331, equipo 3. Semestre 2 de 2026.
- **Entrega: viernes 9 de octubre de 2026.** No sabemos todavía si es la entrega final, así que el objetivo es un MVP funcionando para esa fecha.
- Backlog: [issues del repo](https://github.com/AlejandroMG/inf331-equipo-3/issues), organizados en milestones `Sprint 1`, `Sprint 2`, `Post 9 de octubre` y `Extras`.

## Reglas obligatorias

1. **Nunca hagas un commit sin preguntar.** Los commits son manuales. Prepara los cambios, muestra un resumen de los archivos y el mensaje de commit propuesto, y espera un "sí" explícito de la persona. Lo mismo vale para `push`, `commit --amend`, `merge`, `rebase` y tags. Que una tarea esté terminada no es permiso para commitear.
2. **Registra cada sesión de trabajo en [`docs/memory.md`](docs/memory.md)** con la plantilla que está al inicio de ese archivo: qué se hizo, qué se decidió y por qué, y qué necesita saber el resto. Hazlo al final de la sesión, antes de proponer el commit, y agrega la entrada al final del archivo.
3. **Respeta las decisiones de [`docs/decisiones.md`](docs/decisiones.md).** Si una tarea obliga a cambiar una decisión, detente y pregunta; si se aprueba, registra la nueva decisión en ese archivo en vez de cambiarla en silencio.
4. **Nada de secretos en el repo.** Toda variable de entorno nueva se documenta en [`.env.example`](.env.example) y en [`docs/arquitectura.md`](docs/arquitectura.md#variables-de-entorno).
5. **Trabaja dentro del dominio del issue.** Si necesitas tocar un módulo de otro integrante, avísalo en la entrada de `memory.md` y en el PR.
6. **Toda historia termina con tests** (ver [Definición de terminado](docs/flujo-de-trabajo.md#definición-de-terminado)).

## Equipo y dominios

| Rol | GitHub | Dominio | Back (módulos Nest) | Front |
|---|---|---|---|---|
| A | [@AlejandroMG](https://github.com/AlejandroMG) | Cuentas, IA y administración | `prisma`, `auth`, `users`, `ai`, `reviews`, `admin` | login y registro, perfil, panel del arrendatario, panel admin |
| B | [@xReNatS](https://github.com/xReNatS) | Espacios y catálogo | `spaces`, `space-types`, `catalog`, `storage` | base del front, publicar, catálogo, detalle, panel del propietario |
| C | [@gonzzza-lol](https://github.com/gonzzza-lol) | Reservas y pagos | `availability`, `bookings`, `payments` | horario semanal, widget de reserva, pago |

A es dueño de `schema.prisma` y revisa todos sus cambios. C es dueño del CI.

## Mapa del repositorio

```
inf331-equipo-3/
├── AGENTS.md              ← este archivo
├── README.md              ← cómo levantar el proyecto
├── .env.example           ← variables de entorno documentadas
├── docs/                  ← documentación (ver índice en docs/README.md)
├── rentsmart-back/        ← API REST, NestJS 12 + TypeScript
│   ├── src/               ← un módulo por dominio (src/<dominio>/)
│   └── test/              ← tests e2e de la API (Supertest)
└── rentsmart-front/       ← SPA, React 19 + Vite 8 + Tailwind 4
    └── src/               ← src/features/<dominio>/, src/components/, src/lib/
```

## Comandos

| Dónde | Comando | Para qué |
|---|---|---|
| `rentsmart-back` | `npm run start:dev` | API en http://localhost:3000 con recarga |
| `rentsmart-back` | `npm test` / `npm run test:e2e` / `npm run test:cov` | Tests unitarios, e2e y cobertura |
| `rentsmart-back` | `npm run lint` · `npm run build` | oxlint · compilación |
| `rentsmart-front` | `npm run dev` | App en http://localhost:5173 |
| `rentsmart-front` | `npm run build` · `npm run lint` | Build de producción · ESLint |

Antes de proponer un commit, corre build, lint y tests de la app que tocaste.

## Stack y trampas conocidas

- **Node.js 24.9 o superior.** NestJS 12 se publica solo como ES Modules y Jest necesita Node 24.9+ para cargarlo. Con Node 22 el back compila, pero `npm test` falla con "Must use import to load ES Module".
- **Tailwind 4** se configura con el plugin `@tailwindcss/vite` en `vite.config.js` y con `@import "tailwindcss"` en el CSS. No hay `tailwind.config.js`.
- **Front en TypeScript** (P-04, F-07): el código nuevo va en `.ts`/`.tsx`. `npm run build` ejecuta `tsc -b` antes de Vite.
- **Base de datos:** PostgreSQL + Prisma (P-03). Se agrega en F-03/F-04; revisa `docs/arquitectura.md` antes de modelar.
- **Stripe** necesita el body sin parsear para verificar la firma del webhook: `NestFactory.create(AppModule, { rawBody: true })`.
- El back no usa `@nestjs/observe`: se quitó de la plantilla porque traía credenciales de ejemplo.

## Reglas de negocio clave

El detalle está en [`docs/producto.md`](docs/producto.md) y [`docs/decisiones.md`](docs/decisiones.md). Resumen:

- Una cuenta puede publicar y reservar; se habilita como propietario al publicar su primer espacio. El rol `ADMIN` va aparte.
- Reserva **inmediata**, sin aprobación del propietario: `Pendiente → Pagada → Confirmada`, luego `Finalizada`. Además existen `Cancelada` y `Expirada`.
- `Pendiente` retiene el horario **30 minutos** mientras se paga en Stripe Checkout. Al pagar, el webhook la pasa a `Pagada` y una validación automática la pasa a `Confirmada`, o la cancela con reembolso total si falla.
- Se arrienda por hora y/o por día según el espacio. Bloques de 1 hora, con mínimo de 1 hora.
- 8 tipos de espacio en una lista cerrada que el admin puede ampliar. No se permite alojamiento.
- Región y comuna salen de una lista cerrada. La dirección es pública; el detalle (depto, oficina, indicaciones) solo lo ve quien tiene una reserva `Confirmada`.
- Fotos en Supabase Storage. Montos en CLP como enteros. Fechas en UTC en la BD, mostradas en `America/Santiago`.

## Convenciones de código

- Identificadores y nombres de archivos en inglés (`BookingService`, `bookings.controller.ts`). Textos de la interfaz, documentación y mensajes de commit en español.
- **Back:** un módulo Nest por dominio con `*.controller.ts`, `*.service.ts`, `dto/` y `*.spec.ts` al lado del código. Validación con `class-validator` en DTOs. La lógica de negocio va en servicios, no en controladores. Errores: 400 validación, 401 sin sesión, 403 sin permiso, 404 no existe, 409 conflicto de estado o de horario.
- **API:** REST JSON bajo `/api`, Swagger en `/docs`, fechas ISO 8601 en UTC, paginación con `?page=&pageSize=`.
- **Front:** código por dominio en `src/features/<dominio>/`, componentes base en `src/components/`, cliente HTTP en `src/lib/`. Mocks de MSW en `src/mocks/` mientras el endpoint real no exista.
- Commits con prefijo convencional y el ID de la historia: `feat(bookings): RE-02 crear reserva pendiente`.
- **Ramas con GitFlow** ([T-05](docs/decisiones.md#t-05--gitflow-desde-la-entrega-1)): `feature/<ID>-…` desde `develop` y PR hacia `develop`; `main` solo recibe releases (`release/vX.0-entregaN`) con su tag. Detalle en [`CONTRIBUTING.md`](CONTRIBUTING.md#ramas-gitflow).

## Documentación

| Archivo | Contenido |
|---|---|
| [`docs/README.md`](docs/README.md) | Índice de la documentación |
| [`docs/producto.md`](docs/producto.md) | Alcance, roles y reglas de negocio |
| [`docs/arquitectura.md`](docs/arquitectura.md) | Componentes, módulos, modelo de datos, flujo de reserva y pago, variables de entorno |
| [`docs/decisiones.md`](docs/decisiones.md) | Registro de decisiones y las que siguen abiertas |
| [`docs/plan.md`](docs/plan.md) | Sprints, responsables y entregas entre integrantes |
| [`docs/flujo-de-trabajo.md`](docs/flujo-de-trabajo.md) | Ramas, commits, PRs, revisiones y definición de terminado |
| [`docs/memory.md`](docs/memory.md) | Bitácora de sesiones de trabajo (obligatoria) |
