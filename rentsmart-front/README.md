# rentsmart-front

SPA de RentSmart: React 19, TypeScript, Vite 8, Tailwind 4 y React Router 7. La estructura y las convenciones están en [`docs/arquitectura.md`](../docs/arquitectura.md#frontend).

## Comandos

| Comando | Para qué |
|---|---|
| `npm run dev` | Servidor de desarrollo en http://localhost:5173 |
| `npm run build` | Revisa los tipos (`tsc -b`) y genera `dist/` |
| `npm run lint` | ESLint con typescript-eslint |
| `npm run preview` | Sirve `dist/` para probar el build |

Antes, desde la raíz del repo: `cp .env.example rentsmart-front/.env`.

En desarrollo, `/dev/componentes` muestra la guía de componentes base.
