const { API_URL, SEED_PASSWORD } = require('./config');

/** Llamada directa a la API para preparar datos sin pasar por la interfaz (usa el fetch de Node). */
async function request(method, route, { token, body } = {}) {
  const response = await fetch(`${API_URL}/api${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${route} respondió ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

/** Email único por ejecución: las pruebas crean sus propios usuarios y no dependen del orden ni de corridas anteriores. */
const uniqueEmail = (prefix = 'e2e') => `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@rentsmart.test`;

const login = (email, password = SEED_PASSWORD) => request('POST', '/auth/login', { body: { email, password } });

// El login de la API limita a 10 intentos por IP cada 15 minutos (CU-05, ThrottlerModule). Para no agotarlo, cada
// usuario inicia sesión por API una sola vez por ejecución y el token se reutiliza; solo las pruebas que verifican el
// formulario de login pasan por la interfaz.
const sessions = new Map();
const sessionFor = (email, password = SEED_PASSWORD) => {
  if (!sessions.has(email)) sessions.set(email, login(email, password));
  return sessions.get(email);
};

/** Crea una cuenta nueva por API (no inicia sesión, para no gastar el límite del login). */
async function createUser(name = 'Persona E2E') {
  const email = uniqueEmail();
  await request('POST', '/auth/register', { body: { name, email, password: SEED_PASSWORD } });
  return { email, password: SEED_PASSWORD, name };
}

/** Crea un borrador de espacio del propietario (solo el nombre es obligatorio). */
const createDraftSpace = (token, name) => request('POST', '/spaces', { token, body: { name } });

module.exports = { request, uniqueEmail, login, sessionFor, createUser, createDraftSpace };
