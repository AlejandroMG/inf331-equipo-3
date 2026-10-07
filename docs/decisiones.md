# Registro de decisiones

Cada decisión del producto tiene un ID `P-xx` que coincide con su issue en GitHub (etiqueta `decisión`). Las decisiones técnicas internas usan `T-xx`. Una decisión no se cambia en silencio: se agrega una nueva que la reemplaza y se marca la anterior como **Reemplazada por**.

## Resumen

| ID | Decisión | Estado | Fecha |
|---|---|---|---|
| [P-01](#p-01--dos-sprints-hasta-el-9-de-octubre) | Dos sprints de una semana hasta el 9 de octubre | Decidida | 25-09-2026 |
| [P-02](#p-02--una-cuenta-con-ambos-modos) | Una cuenta con ambos modos | Decidida | 25-09-2026 |
| [P-03](#p-03--postgresql--prisma) | PostgreSQL + Prisma | Decidida | 25-09-2026 |
| [P-04](#p-04--front-en-typescript) | Front en TypeScript | Decidida | 25-09-2026 |
| [P-05](#p-05--reserva-inmediata) | Reserva inmediata | Decidida | 25-09-2026 |
| [P-06](#p-06--pendiente--pagada--confirmada) | Pendiente → Pagada → Confirmada | Decidida | 25-09-2026 |
| [P-07](#p-07--por-hora-yo-por-día-en-bloques-de-1-hora) | Por hora y/o por día, bloques de 1 hora | Decidida | 25-09-2026 |
| [P-08](#p-08--lista-cerrada-de-8-tipos-de-espacio) | Lista cerrada de 8 tipos de espacio | Decidida | 25-09-2026 |
| [P-09](#p-09--ubicación-pública-con-detalle-privado) | Ubicación pública con detalle privado | Decidida | 25-09-2026 |
| [P-10](#p-10--fotos-en-supabase-storage) | Fotos en Supabase Storage | Decidida | 25-09-2026 |
| [P-11](#p-11--meta-de-pruebas) | Meta de pruebas | En espera del profesor | — |
| [P-18](#p-18--tipo-y-comuna-también-son-obligatorios-para-publicar) | Tipo y comuna también son obligatorios para publicar | Decidida | 05-10-2026 |
| [T-01](#t-01--dominios-verticales-por-integrante) | Dominios verticales por integrante | Decidida | 25-09-2026 |
| [T-02](#t-02--quitar-nestjsobserve) | Quitar `@nestjs/observe` | Decidida | 25-09-2026 |
| [T-03](#t-03--nodejs-249-o-superior) | Node.js 24.9 o superior | Decidida | 25-09-2026 |
| [T-04](#t-04--commits-manuales-y-bitácora-de-sesiones) | Commits manuales y bitácora de sesiones | Decidida | 25-09-2026 |

Decisiones abiertas: ver [al final](#decisiones-abiertas).

---

## P-01 · Dos sprints hasta el 9 de octubre

- **Estado:** Decidida, 25-09-2026 · Issue [#68](https://github.com/AlejandroMG/inf331-equipo-3/issues/68)
- **Contexto:** la entrega es el viernes 9 de octubre de 2026 y el trabajo parte el 25 de septiembre. No sabemos si es la entrega final.
- **Decisión:** dos sprints de una semana. Sprint 1 del 25 de septiembre al 2 de octubre y Sprint 2 del 3 al 9 de octubre. El Sprint 0 de fundaciones se absorbe en los primeros días del Sprint 1.
- **Alternativas descartadas:** el plan original de un Sprint 0 y cuatro sprints de dos semanas (unas 9 semanas) no cabe antes de la entrega.
- **Consecuencias:** el alcance se recortó a un MVP (ver [producto.md](producto.md#alcance-para-el-9-de-octubre-mvp)). Lo demás quedó en el milestone *Post 9 de octubre*, para replanificar si el proyecto sigue. El plan de cada sprint está en [plan.md](plan.md).

## P-02 · Una cuenta con ambos modos

- **Estado:** Decidida, 25-09-2026 · Issue [#69](https://github.com/AlejandroMG/inf331-equipo-3/issues/69)
- **Contexto:** el enunciado pide distinguir entre quien publica y quien reserva.
- **Decisión:** una sola cuenta puede reservar y publicar, como en Airbnb. El usuario se habilita como propietario (`isHost = true`) al publicar su primer espacio. El rol `ADMIN` es aparte.
- **Alternativas descartadas:** elegir el rol al registrarse. Obligaría a tener dos cuentas para hacer ambas cosas y duplicaría los flujos de registro.
- **Consecuencias:** los permisos se revisan por rol (`USER`, `ADMIN`) y por propiedad del recurso (solo el dueño edita su espacio), no por tipo de cuenta.

## P-03 · PostgreSQL + Prisma

- **Estado:** Decidida, 25-09-2026 · Issue [#70](https://github.com/AlejandroMG/inf331-equipo-3/issues/70)
- **Contexto:** hay que persistir datos relacionales (usuarios, espacios, reservas, pagos) y garantizar que dos reservas no se crucen.
- **Decisión:** PostgreSQL con Prisma como ORM.
- **Alternativas descartadas:** TypeORM, que es más verboso y tiene migraciones menos predecibles; MongoDB, porque las transacciones y los conflictos de agenda son más difíciles de garantizar.
- **Consecuencias:** Prisma genera los tipos para TypeScript. La restricción de exclusión contra reservas cruzadas, que Prisma no soporta en el schema, se escribe en SQL dentro de una migración (ver [arquitectura.md](arquitectura.md#cómo-se-evitan-reservas-cruzadas)). La BD de desarrollo y de test corre en Docker.

## P-04 · Front en TypeScript

- **Estado:** Decidida, 25-09-2026 · Issue [#71](https://github.com/AlejandroMG/inf331-equipo-3/issues/71)
- **Contexto:** el back quedó en TypeScript y el front en JavaScript, y el front todavía es solo la plantilla de Vite.
- **Decisión:** migrar el front a TypeScript ahora, como parte de F-07.
- **Alternativas descartadas:** seguir en JavaScript. Es menos configuración, pero los errores de contrato con la API recién aparecen al probar.
- **Consecuencias:** los tipos de los DTOs se pueden reflejar en el front. La migración cuesta poco porque casi no hay código.

## P-05 · Reserva inmediata

- **Estado:** Decidida, 25-09-2026 · Issue [#72](https://github.com/AlejandroMG/inf331-equipo-3/issues/72)
- **Contexto:** había que elegir entre una solicitud que el propietario aprueba o una reserva inmediata.
- **Decisión:** reserva inmediata. El arrendatario paga y la reserva se confirma sin aprobación del propietario.
- **Alternativas descartadas:** solicitud con aprobación del propietario, que agrega una espera y más estados; reserva configurable por espacio, que cuesta más de lo que cabe en dos semanas.
- **Consecuencias:** desaparece el estado *Rechazada* y la historia de aceptar o rechazar. RE-04 pasó a ser la confirmación automática tras el pago y el panel del propietario solo muestra reservas. El horario semanal publicado tiene que ser confiable, porque el propietario no filtra solicitudes.

## P-06 · Pendiente → Pagada → Confirmada

- **Estado:** Decidida, 25-09-2026 · Issue [#73](https://github.com/AlejandroMG/inf331-equipo-3/issues/73)
- **Contexto:** con reserva inmediata había que definir los estados y qué pasa con el horario mientras la persona paga.
- **Decisión:**
  - La reserva nace en **Pendiente** y retiene el horario **30 minutos**, el mínimo que permite Stripe Checkout para expirar una sesión.
  - El webhook de Stripe la pasa a **Pagada**.
  - Una validación automática (espacio activo y horario libre) la pasa a **Confirmada** y avisa a ambas partes. Si falla, la pasa a **Cancelada** con reembolso total.
  - Además existen **Finalizada** (terminó el horario), **Cancelada** y **Expirada** (no pagó en 30 minutos).
- **Alternativas descartadas:** Pendiente → Confirmada al pagar, sin un estado Pagada separado; que el propietario confirme después del pago.
- **Consecuencias:** se mantienen los estados del enunciado. Pagada y Confirmada se distinguen por la validación posterior al pago. Bloquean el horario: Pendiente no vencida, Pagada y Confirmada. Diagrama en [arquitectura.md](arquitectura.md#ciclo-de-vida-de-una-reserva).

## P-07 · Por hora y/o por día, en bloques de 1 hora

- **Estado:** Decidida, 25-09-2026 · Issue [#74](https://github.com/AlejandroMG/inf331-equipo-3/issues/74)
- **Decisión:** cada espacio tiene precio por hora, por día o ambos. Se reserva en bloques de 1 hora, con un mínimo de 1 hora. "Por día" es todo el horario disponible de ese día.
- **Alternativas descartadas:** solo por hora, que es más simple pero no sirve para salones o talleres de jornada completa; bloques de 30 minutos, que duplican los bloques y los casos de borde.
- **Consecuencias:** el horario semanal y las reservas usan horas cerradas (09:00, 10:00…). El precio por día se cobra aunque el horario de ese día sea más corto.

## P-08 · Lista cerrada de 8 tipos de espacio

- **Estado:** Decidida, 25-09-2026 · Issue [#75](https://github.com/AlejandroMG/inf331-equipo-3/issues/75)
- **Decisión:** sala de reuniones, oficina o cowork, estudio fotográfico o audiovisual, sala de ensayo, cocina equipada, cancha, salón de eventos y taller. El admin puede agregar tipos. No se permite alojamiento.
- **Alternativas descartadas:** texto libre, que complica filtrar; una lista más corta, que deja fuera ejemplos del enunciado.
- **Consecuencias:** los tipos viven en la tabla `SpaceType`, cargada por el seed. El alojamiento queda fuera porque es otro negocio, con otras reglas y regulaciones.

## P-09 · Ubicación pública con detalle privado

- **Estado:** Decidida, 25-09-2026 · Issue [#76](https://github.com/AlejandroMG/inf331-equipo-3/issues/76)
- **Decisión:** región y comuna salen de una lista cerrada y sirven para filtrar. La dirección (calle y número) es pública desde el inicio. El detalle (número de depto u oficina, indicaciones de acceso) es privado y solo lo ve quien tiene una reserva Confirmada en ese espacio.
- **Alternativas descartadas:** mostrar solo una zona aproximada hasta reservar; mapa con coordenadas desde el MVP (queda como extra ES-07).
- **Consecuencias:** `Space` tiene `address` (pública) y `addressDetail` (privada). Los endpoints públicos nunca devuelven `addressDetail`, y eso se cubre con un test.

## P-10 · Fotos en Supabase Storage

- **Estado:** Decidida, 25-09-2026 · Issue [#77](https://github.com/AlejandroMG/inf331-equipo-3/issues/77)
- **Decisión:** las fotos se guardan en Supabase Storage (bucket `space-photos`), detrás de un `StorageService`.
- **Alternativas descartadas:** Cloudinary; disco del servidor, donde las fotos se pierden al redesplegar en la mayoría de los hostings gratuitos.
- **Consecuencias:** se sube desde el back con la service role key, que nunca llega al front. Los tests usan una implementación local del `StorageService`. Si también se usa Supabase para PostgreSQL (P-17), queda todo en un solo proveedor.

## P-11 · Meta de pruebas

- **Estado:** En espera del profesor · Issue [#78](https://github.com/AlejandroMG/inf331-equipo-3/issues/78)
- **Contexto:** el ramo puede exigir una cobertura mínima, ciertos tipos de prueba o informes.
- **Decisión provisoria:** no se fija una meta de cobertura hasta tener la respuesta. Mientras tanto, cada historia exige tests según la [definición de terminado](flujo-de-trabajo.md#definición-de-terminado). F-10 (plan de pruebas y Playwright) quedó para después del 9 de octubre.

## P-18 · Tipo y comuna también son obligatorios para publicar

- **Estado:** Decidida, 05-10-2026 · Sin issue todavía
- **Contexto:** `producto.md` exigía foto, precio, capacidad, descripción y horario para publicar. Un espacio sin tipo ni comuna se mostraría en el catálogo sin esos datos y nunca aparecería en los filtros por tipo y comuna (BU-03).
- **Decisión:** para publicar también se exigen el tipo de espacio y la comuna. Las mismas reglas valen para reactivar un espacio desactivado y para editar uno ya publicado: no puede quedar sin alguno de esos datos (ni sin su última foto); para dejarlo incompleto hay que desactivarlo primero.
- **Alternativas descartadas:** exigir solo lo que decía `producto.md` y tolerar tipo o comuna vacíos en el catálogo (queda como respaldo, pero esos espacios no saldrían en los filtros).
- **Consecuencias:** `POST /api/spaces/:id/publish` y `PATCH /api/spaces/:id/status` responden 409 con `missing` (`type`, `description`, `capacity`, `commune`, `price`, `photos`, `schedule`). El formulario del front debe agregar tipo y comuna a la lista "Para publicar necesitas".

## P-19 · Ubicación en el mapa: el propietario marca el punto y el público ve una zona aproximada

- **Estado:** Decidida, 06-10-2026 · Issue [#26](https://github.com/AlejandroMG/inf331-equipo-3/issues/26) (ES-07)
- **Contexto:** P-09 dejó el mapa como extra (ES-07) y `Space` solo tenía la dirección escrita.
- **Decisión:** el propietario puede marcar el punto de su espacio en un mapa (Leaflet con teselas de OpenStreetMap) al publicar; es opcional. El detalle público muestra un círculo de unos 150 m, no un pin: la API redondea las coordenadas a 3 decimales (~110 m) y el punto real queda siempre dentro del círculo. La dirección escrita sigue siendo pública (P-09). Las coordenadas exactas solo las ve el dueño.
- **Alternativas descartadas:** geocodificar la dirección con Nominatim (depende de un servicio externo con límite de uso y no siempre encuentra direcciones chilenas); usar solo el centro de la comuna (todos los espacios de una comuna caerían en el mismo punto); mostrar el pin exacto (el issue pide una ubicación "aproximada").
- **Consecuencias:** `Space` agrega `latitude` y `longitude` (`Float?`, siempre juntas: lo exige un `CHECK` de la BD). Es un cambio de `schema.prisma` y lo revisa A. Los endpoints públicos nunca devuelven el punto exacto y un test e2e lo comprueba. Las teselas públicas de OSM tienen una política de uso razonable: sirven para el MVP, y con tráfico real hay que cambiar `TILE_URL` por un proveedor propio.

## T-01 · Dominios verticales por integrante

- **Estado:** Decidida, 25-09-2026
- **Decisión:** cada integrante es dueño de un dominio completo (BD, API, UI y tests): A cuentas, IA y administración; B espacios y catálogo; C reservas y pagos.
- **Por qué:** permite trabajar en paralelo con menos conflictos de merge y deja un responsable claro por módulo. Repartir por capas (uno back, otro front) haría que todos esperaran a todos.
- **Consecuencias:** el contrato de la API (Swagger) y el schema de Prisma se acuerdan primero. Las entregas entre integrantes están en [plan.md](plan.md#entregas-entre-integrantes).

## T-02 · Quitar `@nestjs/observe`

- **Estado:** Decidida, 25-09-2026
- **Decisión:** se quitó el módulo de observabilidad que traía la plantilla de NestJS.
- **Por qué:** venía registrado con credenciales de ejemplo (`YOUR_APP_KEY`, `YOUR_APP_SECRET`) y el proyecto no lo necesita. Para logs se usa el `Logger` de Nest.

## T-03 · Node.js 24.9 o superior

- **Estado:** Decidida, 25-09-2026
- **Decisión:** todo el equipo usa Node.js 24.9 o superior.
- **Por qué:** NestJS 12 se publica solo como ES Modules, y Jest necesita Node 24.9+ para cargarlo. Con Node 22 el back compila, pero los tests fallan con "Must use import to load ES Module".

## T-04 · Commits manuales y bitácora de sesiones

- **Estado:** Decidida, 25-09-2026
- **Decisión:** los commits son manuales: ningún agente de IA commitea sin preguntar y recibir un "sí" explícito. Cada sesión de trabajo se registra en [memory.md](memory.md) con la plantilla común.
- **Por qué:** cada integrante mantiene el control de lo que entra al repo, y el razonamiento detrás de cada cambio queda escrito para el resto del equipo y para los agentes que retomen el trabajo.

---

## Decisiones abiertas

| ID | Pregunta | Recomendación | Necesaria antes de |
|---|---|---|---|
| [P-12](https://github.com/AlejandroMG/inf331-equipo-3/issues/79) | ¿Stripe con o sin Connect? | Checkout en modo test, sin Connect; la plataforma cobra el total y registra la comisión | 3 de octubre (PA-01) |
| [P-13](https://github.com/AlejandroMG/inf331-equipo-3/issues/80) | ¿De cuánto es la comisión y quién la paga? | 10 % sumado al arrendatario, visible en el desglose | 3 de octubre (RE-02) |
| [P-15](https://github.com/AlejandroMG/inf331-equipo-3/issues/82) | ¿Qué proveedor de IA y quién paga la API? | Un modelo pequeño con visión; preguntar si el ramo da créditos | 3 de octubre (IA-01) |
| [P-17](https://github.com/AlejandroMG/inf331-equipo-3/issues/84) | ¿Dónde desplegamos? | Vercel (front), Render o Railway (back), Neon o Supabase (BD) | 3 de octubre (QA-03) |
| [P-14](https://github.com/AlejandroMG/inf331-equipo-3/issues/81) | ¿Política de cancelación y reembolso? | Gratis hasta 24 h antes; si cancela el propietario, reembolso total | Después del 9 de octubre |
| [P-16](https://github.com/AlejandroMG/inf331-equipo-3/issues/83) | ¿Reseñas en una o ambas direcciones? | Solo al espacio en el MVP | Después del 9 de octubre |

## Plantilla para una decisión nueva

```markdown
## P-xx · Título corto

- **Estado:** Propuesta | Decidida, DD-MM-AAAA | Reemplazada por P-yy · Issue #N
- **Contexto:** qué problema o pregunta la motivó.
- **Decisión:** qué se eligió, en concreto.
- **Alternativas descartadas:** qué más se consideró y por qué no.
- **Consecuencias:** qué cambia en el código, el backlog o el producto.
```
