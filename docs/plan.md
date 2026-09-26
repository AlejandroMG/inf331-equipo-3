# Plan de trabajo

Entrega: **viernes 9 de octubre de 2026**. Dos sprints de una semana ([P-01](decisiones.md#p-01--dos-sprints-hasta-el-9-de-octubre)). El backlog completo está en los [issues](https://github.com/AlejandroMG/inf331-equipo-3/issues) y los milestones son la fuente de verdad. Si este documento y GitHub no coinciden, manda GitHub; corrige este archivo.

## Equipo

| Rol | Integrante | Dominio |
|---|---|---|
| A | [@AlejandroMG](https://github.com/AlejandroMG) | Cuentas, IA y administración |
| B | [@xReNatS](https://github.com/xReNatS) | Espacios y catálogo |
| C | [@gonzzza-lol](https://github.com/gonzzza-lol) | Reservas y pagos |

## Sprint 1 · 25 sep – 2 oct

**Meta:** proyecto andando con BD, login y CI; un propietario publica un espacio con fotos y horario. · [Milestone](https://github.com/AlejandroMG/inf331-equipo-3/milestone/2)

| Quién | Historias | Pts |
|---|---|---|
| A | [F-01](https://github.com/AlejandroMG/inf331-equipo-3/issues/1) Reparar la estructura base · [F-03](https://github.com/AlejandroMG/inf331-equipo-3/issues/3) Modelo de datos, migración y seed · [F-04](https://github.com/AlejandroMG/inf331-equipo-3/issues/4) PostgreSQL en Docker · [CU-01](https://github.com/AlejandroMG/inf331-equipo-3/issues/12) Registro · [CU-02](https://github.com/AlejandroMG/inf331-equipo-3/issues/13) Login JWT · [CU-03](https://github.com/AlejandroMG/inf331-equipo-3/issues/14) Roles y guards · [CU-04](https://github.com/AlejandroMG/inf331-equipo-3/issues/15) Modo propietario | 15 |
| B | [F-07](https://github.com/AlejandroMG/inf331-equipo-3/issues/7) Base del front en TypeScript · [F-08](https://github.com/AlejandroMG/inf331-equipo-3/issues/8) Vitest + MSW · [F-09](https://github.com/AlejandroMG/inf331-equipo-3/issues/9) Wireframes · [ES-01](https://github.com/AlejandroMG/inf331-equipo-3/issues/20) Tipos de espacio · [ES-02](https://github.com/AlejandroMG/inf331-equipo-3/issues/21) Publicar espacio · [ES-03](https://github.com/AlejandroMG/inf331-equipo-3/issues/22) Fotos | 15 |
| C | [F-06](https://github.com/AlejandroMG/inf331-equipo-3/issues/6) CI y main protegida · [F-11](https://github.com/AlejandroMG/inf331-equipo-3/issues/11) Tablero y convenciones · [DI-01](https://github.com/AlejandroMG/inf331-equipo-3/issues/35) Horario semanal · [DI-02](https://github.com/AlejandroMG/inf331-equipo-3/issues/36) Servicio de disponibilidad · [RE-01](https://github.com/AlejandroMG/inf331-equipo-3/issues/38) Estados de la reserva | 14 |
| Todos | [F-02](https://github.com/AlejandroMG/inf331-equipo-3/issues/2) Decisiones iniciales · [F-05](https://github.com/AlejandroMG/inf331-equipo-3/issues/5) Contrato de API en Swagger | 3 |

**Orden sugerido para no bloquearse:**

1. **Días 1–2:** A sube el schema de Prisma y el Docker Compose (F-03, F-04). Los tres acuerdan el contrato de la API en Swagger (F-05). B deja lista la base del front con MSW; C, el CI.
2. **Días 2–3:** A entrega los guards de autenticación. Mientras tanto, B y C trabajan con un usuario fijo del seed.
3. **Resto de la semana:** cada uno avanza en su dominio.

## Sprint 2 · 3 – 9 oct

**Meta:** MVP para la entrega. Se busca un espacio, se reserva, se paga en Stripe (test) y queda confirmado. Además IA de descripción, paneles y admin básico. · [Milestone](https://github.com/AlejandroMG/inf331-equipo-3/milestone/3)

| Quién | Historias | Pts |
|---|---|---|
| A | [CU-05](https://github.com/AlejandroMG/inf331-equipo-3/issues/16) Seguridad base · [IA-01](https://github.com/AlejandroMG/inf331-equipo-3/issues/52) Módulo de IA · [IA-02](https://github.com/AlejandroMG/inf331-equipo-3/issues/53) Descripción con IA · [PN-03](https://github.com/AlejandroMG/inf331-equipo-3/issues/50) Panel del arrendatario · [AD-01](https://github.com/AlejandroMG/inf331-equipo-3/issues/60) Admin de usuarios · [QA-03](https://github.com/AlejandroMG/inf331-equipo-3/issues/66) Staging | 17 |
| B | [ES-04](https://github.com/AlejandroMG/inf331-equipo-3/issues/23) Reglas para publicar · [ES-05](https://github.com/AlejandroMG/inf331-equipo-3/issues/24) Editar · [ES-06](https://github.com/AlejandroMG/inf331-equipo-3/issues/25) Activar/desactivar · [BU-01](https://github.com/AlejandroMG/inf331-equipo-3/issues/27) Catálogo · [BU-02](https://github.com/AlejandroMG/inf331-equipo-3/issues/28) Detalle · [BU-03](https://github.com/AlejandroMG/inf331-equipo-3/issues/29) Filtros · [PN-01](https://github.com/AlejandroMG/inf331-equipo-3/issues/48) Panel del propietario | 16 |
| C | [RE-02](https://github.com/AlejandroMG/inf331-equipo-3/issues/39) Reservar · [RE-03](https://github.com/AlejandroMG/inf331-equipo-3/issues/40) Evitar reservas cruzadas · [PA-01](https://github.com/AlejandroMG/inf331-equipo-3/issues/45) Stripe Checkout · [PA-02](https://github.com/AlejandroMG/inf331-equipo-3/issues/46) Webhook · [RE-04](https://github.com/AlejandroMG/inf331-equipo-3/issues/41) Confirmación automática | 18 |

**Decisiones que hay que cerrar antes del 3 de octubre:** [P-12](https://github.com/AlejandroMG/inf331-equipo-3/issues/79) (Stripe Connect), [P-13](https://github.com/AlejandroMG/inf331-equipo-3/issues/80) (comisión), [P-15](https://github.com/AlejandroMG/inf331-equipo-3/issues/82) (proveedor de IA) y [P-17](https://github.com/AlejandroMG/inf331-equipo-3/issues/84) (deploy).

### Si no alcanza el tiempo

El plan es ajustado: unos 15 puntos por persona por semana. Si el jueves 8 no está todo, se recorta en este orden:

1. AD-01 queda como listado de usuarios con suspender, sin búsqueda.
2. BU-03 queda solo con filtros por tipo y comuna.
3. ES-05: la edición del espacio se limita a precio y descripción.
4. PN-01 muestra solo la lista de espacios.

No se recorta: login, publicar con fotos, catálogo y detalle, reserva con pago y confirmación, IA de descripción y la validación de conflictos. Son los requisitos centrales del enunciado.

## Entregas entre integrantes

| Cuándo | De → para | Qué |
|---|---|---|
| S1, día 1–2 | A → todos | `schema.prisma`, migración inicial y seed con usuarios de cada rol |
| S1, día 1–2 | Todos | Contrato de la API en Swagger; el front trabaja contra mocks de MSW |
| S1, día 3 | A → B, C | `JwtAuthGuard`, `RolesGuard` y `@CurrentUser()` |
| S1 | C → B | Componente `<HorarioSemanal>` para el formulario de espacio |
| S1 | C → B | `GET /api/spaces/:id/availability` |
| S2, inicio | B → C | Lugar en el detalle del espacio para `<BookingWidget spaceId />` |
| S2, inicio | B → A | El formulario de espacio expone el campo descripción para el botón "Generar con IA" |
| S2 | C → A | `GET /api/bookings/me` y `GET /api/payments/me` para el panel del arrendatario |
| S2 | A → C | Staging con URL pública para registrar el webhook de Stripe |

Si una entrega se atrasa, quien la espera sigue con el mock de MSW o con datos del seed, y lo anota en `memory.md`.

## Después del 9 de octubre

El milestone [Post 9 de octubre](https://github.com/AlejandroMG/inf331-equipo-3/milestone/7) tiene lo que quedó fuera: búsqueda en lenguaje natural, reseñas, cancelación y reembolsos, vencimientos automáticos, filtro y calendario de disponibilidad, plan de pruebas y E2E, admin de espacios y métricas, y datos de demo. Se replanifica cuando se sepa si el proyecto continúa. Las ideas opcionales están en [Extras](https://github.com/AlejandroMG/inf331-equipo-3/milestone/6).
