# Release notes

Cada entrega del ramo es un release con su tag sobre `main`. Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [v3.0-entrega3] · 2026-11-20

Tercera entrega: pruebas de interfaz (E2E/UI) con Selenium integradas al pipeline, y el cierre del flujo de reserva y pago.

### Agregado

**Pruebas E2E/UI y pipeline (Entrega 3)**
- 25 pruebas E2E/UI con Selenium WebDriver y Mocha en Chrome headless, contra el stack real (PostgreSQL con seed, API y front compilado): catálogo y búsqueda, registro y login con validaciones, rutas protegidas y permisos, publicar, editar, desactivar y eliminar un espacio, reservar, favoritos y perfil (QA-05, QA-06).
- Job «E2E (Selenium)» en GitHub Actions: levanta el stack, corre las pruebas, falla el pipeline si una falla y publica el resumen, el reporte HTML y JUnit, y los screenshots de las fallas (QA-07).
- Job «Empaquetar»: cuando todas las pruebas pasan, genera los paquetes del back y del front listos para desplegar.
- Reporte de las pruebas E2E como check del pull request, con el resultado de cada caso.
- Documentación de la entrega en [`docs/entrega-3.md`](docs/entrega-3.md) y en la Wiki (QA-08).

**Reservas, pagos y paneles**
- Confirmación del pago por webhook de Stripe (PA-02) y confirmación automática de la reserva pagada, con reembolso total si la validación falla (RE-04).
- Panel del arrendatario: mis reservas y mis pagos, y continuar un pago pendiente (PN-03).
- Calendario de disponibilidad en el detalle del espacio: elegir un bloque libre lo deja cargado en la reserva (BU-06).

**Inteligencia artificial**
- Módulo de IA con proveedor intercambiable (Gemini o un mock para desarrollo y CI), con límites de uso (IA-01).
- Descripción del espacio generada por IA a partir de los datos y las fotos; el propietario la edita y confirma antes de publicar (IA-02).

### Pruebas

- 2198 pruebas en verde en el CI: 784 unitarias y 612 de integración del back, 774 del front, 3 smoke de Playwright y 25 E2E/UI de Selenium.
- Cobertura del back (unitarias): 62,1 % de líneas, 62,7 % de sentencias, 55,1 % de ramas y 71,6 % de funciones.

### No incluido en esta entrega

- Administración de usuarios (AD-01), reseñas (RS-01 a RS-03) y búsqueda en lenguaje natural (IA-03).
- Despliegue público: el pipeline genera los paquetes, pero la aplicación no tiene un ambiente donde publicarlos (P-17).
- Pago con Stripe y cancelación de una reserva dentro de las pruebas E2E/UI (QA-01, BOK-04).

## [v2.0-entrega2] · 2026-11-02

Segunda entrega: reservas, pagos e integración continua.

### Agregado

**Reservas y pagos**
- Servicio de disponibilidad a partir del horario semanal (DI-02).
- Reservar un espacio por hora o por día, con la reserva pendiente que retiene el horario mientras se paga (RE-02).
- Evitar reservas cruzadas con un lock por espacio y un 409 ante el conflicto (RE-03).
- Cancelar una reserva (RE-05) y vencimientos automáticos de reservas pendientes y finalizadas (RE-06).
- Pago con Stripe Checkout en modo test (PA-01) y reembolsos en Stripe al cancelar (PA-03).

**Cuentas**
- Habilitar el modo propietario (CU-04), seguridad de la API (CU-05) y perfil del usuario (CU-06).

**Pipeline**
- Smoke test E2E con Playwright en el CI (F-10).

### Corrección a las notas publicadas

Las notas del release `v2.0-entrega2` decían que los reembolsos quedaban para después; en realidad PA-03 sí está en ese tag. Lo que quedaba pendiente era la confirmación del pago por webhook (PA-02), que llegó en la Entrega 3.

### Pruebas

- 1961 pruebas en verde en el CI del tag; cobertura de líneas del back: 57 %.

## [v1.0-entrega1] · 2026-10-09

Primera entrega: MVP de RentSmart con el CRUD de espacios y pruebas automatizadas.

### Agregado

**Cuentas y acceso**
- Registro con email y contraseña, e inicio y cierre de sesión con JWT (CU-01, CU-02).
- Roles de usuario y administrador que protegen la API y las rutas del front (CU-03).

**Espacios (CRUD principal)**
- Publicar un espacio con un formulario por pasos: tipo, descripción, capacidad, precios por hora y/o día, región, comuna, dirección, reglas y equipamiento (ES-01, ES-02).
- Subir, ordenar y eliminar fotos (ES-03).
- Reglas para publicar: un espacio incompleto queda como borrador y el formulario dice qué falta (ES-04).
- Editar un espacio; un cambio de precio no altera reservas existentes (ES-05).
- Activar y desactivar una publicación (ES-06).
- Ubicación aproximada en un mapa (ES-07).
- Eliminar un espacio sin reservas, con confirmación (ES-08).

**Catálogo y búsqueda**
- Catálogo paginado de espacios activos y detalle con galería, precios, reglas y mapa (BU-01, BU-02).
- Filtros por tipo, precio, comuna y capacidad, búsqueda por texto y orden por precio o fecha; los filtros quedan en la URL (BU-03, BU-04).
- Historial de búsquedas recientes y favoritos (BU-07, BU-08).

**Paneles**
- Panel del propietario: mis espacios, reservas de mis espacios y métricas (PN-01, PN-02, PN-04).
- Administración: despublicar espacios con motivo y administrar tipos de espacio (AD-02).

**Plataforma y calidad**
- API REST en NestJS con Swagger en `/docs`, PostgreSQL con Prisma y datos de prueba (seed) (F-03, F-04, F-05).
- Front en React + TypeScript, responsive y revisado en accesibilidad (F-07, QA-02).
- Pruebas automatizadas: Jest (unitarias del back), Jest + Supertest (integración de la API contra PostgreSQL) y Vitest + React Testing Library + MSW (front) (F-08).
- CI en GitHub Actions: lint, pruebas con cobertura y build en cada pull request (F-06).

### No incluido en esta entrega

- Reservar y pagar (Stripe), y el panel del arrendatario: siguen en desarrollo (RE-02, PA-01, PA-02, PN-03). El panel del propietario muestra reservas de los datos de prueba.
- Descripción de espacios con IA (IA-02).
- Administración de usuarios (AD-01).

[v3.0-entrega3]: https://github.com/AlejandroMG/inf331-equipo-3/releases/tag/v3.0-entrega3
[v2.0-entrega2]: https://github.com/AlejandroMG/inf331-equipo-3/releases/tag/v2.0-entrega2
[v1.0-entrega1]: https://github.com/AlejandroMG/inf331-equipo-3/releases/tag/v1.0-entrega1
