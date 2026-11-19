// Toda la configuración sale de variables de entorno: nada va fijo en las pruebas.
const BASE_URL = (process.env.BASE_URL || 'http://localhost:4173').replace(/\/$/, '');

module.exports = {
  /** Dónde corre el front (el servidor de preview de Vite o el que se despliegue). */
  BASE_URL,
  /** Base de la API. Por defecto es el mismo origen del front, porque `vite preview` reenvía /api al back. */
  API_URL: (process.env.API_URL || BASE_URL).replace(/\/$/, ''),
  /** `HEADLESS=false` abre el navegador para depurar en local. En el CI siempre es headless. */
  HEADLESS: process.env.HEADLESS !== 'false',
  /** Tiempo máximo de espera de un elemento, en milisegundos. */
  WAIT_MS: Number(process.env.WAIT_MS || 10000),
  /** Usuarios que crea el seed del back (rentsmart-back/prisma/seed.ts); todos con la misma contraseña. */
  SEED_PASSWORD: 'Password123',
  USERS: {
    admin: 'admin@rentsmart.test',
    owner: 'propietario@rentsmart.test',
    renter: 'arrendatario@rentsmart.test',
  },
  /** Clave con la que el front guarda el token de sesión (rentsmart-front/src/lib/token.ts). */
  TOKEN_KEY: 'rentsmart_token',
};
