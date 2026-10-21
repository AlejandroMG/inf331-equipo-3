# Cómo contribuir

Guía para quien trabaje en RentSmart, sea del equipo o no. Si usas un agente de IA, además debe seguir [`AGENTS.md`](AGENTS.md).

## Antes de empezar

1. Instala **Node.js 24.9 o superior** y Docker.
2. Sigue los pasos de [cómo levantar el proyecto](README.md#cómo-levantar-el-proyecto).
3. Lee [`docs/producto.md`](docs/producto.md) (reglas de negocio) y [`docs/decisiones.md`](docs/decisiones.md). Si tu cambio contradice una decisión, plantéalo en un issue antes de programarlo.

## Ramas (GitFlow)

| Rama | Para qué | Sale de | Entra a |
|---|---|---|---|
| `main` | Solo versiones entregadas, cada una con su tag (`v1.0-entrega1`, `v2.0-entrega2`…) | — | — |
| `develop` | Integración del trabajo del sprint | `main` | `release/*` |
| `feature/<ID>-descripcion` | Una historia del backlog, por ejemplo `feature/ES-08-eliminar-espacio` | `develop` | `develop` |
| `release/vX.0-entregaN` | Preparar una entrega: solo arreglos, release notes y documentación | `develop` | `main` y de vuelta a `develop` |
| `hotfix/<descripcion>` | Arreglo urgente sobre una versión entregada | `main` | `main` y `develop` |

Para una entrega: se crea `release/vX.0-entregaN` desde `develop`, se actualiza [`CHANGELOG.md`](CHANGELOG.md), se mergea a `main` por pull request, se crea el tag `vX.0-entregaN` sobre ese commit con su Release en GitHub, y se mergea `main` de vuelta a `develop`.

## Commits

- **Los commits son manuales.** Ningún agente de IA hace commit, push, merge ni rebase sin un "sí" explícito de la persona.
- Formato: `<tipo>(<ámbito>): <ID> <descripción en español>`. Tipos: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`, `ci`.
  Ejemplo: `feat(spaces): ES-08 eliminar un espacio sin reservas`.
- Nada de `.env` ni secretos. Las variables nuevas van en [`.env.example`](.env.example).

## Pull requests

- Una historia por PR, idealmente de menos de 400 líneas, con `Closes #N`.
- Completa la [plantilla de PR](.github/pull_request_template.md): qué cambia, cómo probarlo y la definición de terminado.
- Necesita el CI verde y la aprobación de un compañero según la rotación: A revisa a B, B revisa a C y C revisa a A. Si tocas el módulo de otro integrante, esa persona también revisa.
- Se mergea con *squash*.

## Definición de terminado

- Cumple los criterios de aceptación del issue y se puede mostrar funcionando.
- Tests unitarios de la lógica y al menos un test de integración por endpoint nuevo; tests de los componentes del front con lógica.
- Lint, tests y build en verde, en local con Node 24 y en el CI.
- Swagger actualizado, y `docs/` si cambió una regla o la arquitectura.
- Funciona a 375 px y en escritorio.
- Sesión registrada en [`docs/memory.md`](docs/memory.md) con la plantilla.

## Reportar un problema

Abre un [issue](https://github.com/AlejandroMG/inf331-equipo-3/issues) con qué hiciste, qué esperabas y qué pasó. Si es una duda de producto, usa la etiqueta `decisión`.

## Contacto

| Área | Responsable |
|---|---|
| Cuentas, IA y administración | Alejandro Fierro · [@AlejandroMG](https://github.com/AlejandroMG) |
| Espacios y catálogo | Renato Ramírez · [@xReNatS](https://github.com/xReNatS) |
| Reservas, pagos y CI | Gonzalo Gutierrez · [@gonzzza-lol](https://github.com/gonzzza-lol) |
