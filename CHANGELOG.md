# Release notes

Cada entrega del ramo es un release con su tag sobre `main`. Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

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

[v1.0-entrega1]: https://github.com/AlejandroMG/inf331-equipo-3/releases/tag/v1.0-entrega1
