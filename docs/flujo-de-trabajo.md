# Flujo de trabajo

## Del issue al merge

1. Toma un issue asignado a ti del sprint actual. Cuando exista el tablero de GitHub Projects (F-11), muévelo a *In progress*.
2. Crea una rama desde `main` actualizado: `feat/<ID>-descripcion-corta` (por ejemplo `feat/RE-02-reservar-espacio`). Para arreglos usa `fix/…` y para documentación `docs/…`.
3. Trabaja. Si usas un agente de IA, debe seguir [`AGENTS.md`](../AGENTS.md).
4. Antes de commitear, corre build, lint y tests de la app que tocaste.
5. Agrega tu entrada en [`memory.md`](memory.md) con la plantilla.
6. Haz commit (ver reglas abajo) y abre un PR hacia `main` con `Closes #N` en la descripción.
7. Un compañero revisa, según la rotación. Con CI verde y una aprobación, se hace merge con *squash*.

## Commits

- **Los commits son manuales.** Ningún agente de IA hace commit, push, amend, merge ni rebase sin preguntar y recibir un "sí" explícito. El agente propone el mensaje y la lista de archivos; la persona decide.
- Formato: `<tipo>(<ámbito>): <ID> <descripción en español>`
  - Tipos: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`, `ci`.
  - Ejemplo: `feat(bookings): RE-02 crear reserva pendiente con retención de 30 min`.
- Commits chicos y con sentido propio. Nada de `.env` ni secretos.
- Integra a `main` al menos dos veces por semana. Nadie acumula una rama de una semana entera.

## Pull requests

- Una historia por PR, idealmente de menos de 400 líneas cambiadas.
- La descripción incluye qué cambia, cómo probarlo y `Closes #N`.
- Si el PR toca `schema.prisma`, avisa en el grupo; A lo revisa aunque no le toque por rotación.
- Si el PR toca un módulo de otro integrante, esa persona también revisa.

### Rotación de revisión

| Autor | Revisa |
|---|---|
| A (@AlejandroMG) | B (@xReNatS) |
| B (@xReNatS) | C (@gonzzza-lol) |
| C (@gonzzza-lol) | A (@AlejandroMG) |

Así cada uno conoce, además del suyo, un segundo dominio.

La revisión se pide sola: al abrir un PR hacia `main` (o al sacarlo de borrador), el workflow [`assign-reviewer.yml`](../.github/workflows/assign-reviewer.yml) asigna a quien toca por rotación y, además, al dueño de cada módulo ajeno que el PR toca (incluido A si cambia algo en `rentsmart-back/prisma/`). Un PR en borrador no pide revisión. Si cambia el equipo, un dominio o un módulo, hay que actualizar las tablas de ese archivo.

## Definición de terminado

Una historia está terminada cuando:

- [ ] Cumple sus criterios de aceptación y se puede mostrar funcionando.
- [ ] Tiene tests unitarios de la lógica de negocio y al menos un test de integración por endpoint nuevo.
- [ ] Los componentes del front con lógica tienen su test con Testing Library.
- [ ] El CI está verde y el PR tiene una aprobación.
- [ ] Swagger está actualizado con los endpoints y DTOs nuevos.
- [ ] Se ve bien a 375 px y en escritorio.
- [ ] Las variables de entorno nuevas están en `.env.example` y en `docs/arquitectura.md`.
- [ ] La sesión está registrada en `docs/memory.md`.
- [ ] Si cambió una decisión o la arquitectura, `docs/` está actualizado.

## Coordinación

- **Daily asíncrona** en el grupo, cada día: qué hice, qué haré, qué me bloquea.
- **Cierre de sprint** (viernes): demo de la meta, retrospectiva corta y ajuste del backlog.
- Una duda que cambie el producto se registra como issue con la etiqueta `decisión`. Si hay que llevarla a clase, también con `preguntar al profesor`.
