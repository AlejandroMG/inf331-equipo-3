## Qué cambia
<!-- Explica qué se implementó, modificó o corrigió en este PR y por qué. -->

Closes #

## Tipo de cambio
- [ ] `feat`: Nueva funcionalidad
- [ ] `fix`: Corrección de errores
- [ ] `test`: Adición o modificación de pruebas
- [ ] `docs`: Documentación
- [ ] `refactor`: Refactorización de código sin cambio de comportamiento
- [ ] `chore` / `ci`: Tareas de mantenimiento o configuración de CI

## Cómo probarlo
<!-- Detalla los pasos para reproducir o verificar los cambios (comandos, endpoints, URLs, datos de prueba). -->
- 

## Checklist de definición de terminado
- [ ] El PR tiene menos de 400 líneas de código.
- [ ] Cumple sus criterios de aceptación y se puede mostrar funcionando.
- [ ] Tiene tests unitarios de la lógica de negocio y al menos un test de integración por endpoint nuevo (si aplica).
- [ ] Los componentes del front con lógica tienen su test con Testing Library (si aplica).
- [ ] Build, lint y tests pasan localmente sin errores (`npm run build`, `npm run lint`, `npm test`).
- [ ] Swagger está actualizado con los endpoints y DTOs nuevos (si aplica).
- [ ] Se ve bien a 375 px y en escritorio (si incluye interfaz).
- [ ] No hay secretos ni credenciales reales en el código subido; las variables nuevas están en .env.example y en `docs/arquitectura.md` (si aplica).
- [ ] La sesión de trabajo está registrada en `docs/memory.md`.
- [ ] Si cambió una decisión o la arquitectura, `docs/` está actualizado.
- [ ] Si toca `schema.prisma`, fue avisado en el grupo y revisado por Rol A (@AlejandroMG).
- [ ] Si toca módulos de otro integrante, fue avisado y revisado por el dueño del módulo.
