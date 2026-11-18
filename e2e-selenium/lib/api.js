const fs = require('node:fs');
const path = require('node:path');
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

/** Imagen PNG de prueba (64 × 48) que usan las pruebas para las fotos de los espacios. */
const PHOTO_PATH = path.join(__dirname, '..', 'fixtures', 'espacio.png');

/** Comuna fija de los espacios que crean las pruebas: así no aparecen en la búsqueda «Las Condes» de CAT-02. */
const TEST_COMMUNE = 'Providencia';

/**
 * Crea un borrador con todo lo que pide publicar salvo la foto: tipo, descripción, capacidad, comuna, precio y horario
 * de lunes a viernes de 09:00 a 21:00. El precio es alto para no alterar el orden por precio del catálogo.
 */
async function createCompleteDraft(token, name) {
  const [types, regions] = await Promise.all([request('GET', '/space-types'), request('GET', '/regions')]);
  const region = regions.find((item) => item.name === 'Región Metropolitana') ?? regions[0];
  const communes = await request('GET', `/regions/${region.id}/communes`);
  const commune = communes.find((item) => item.name === TEST_COMMUNE) ?? communes[0];
  const space = await request('POST', '/spaces', {
    token,
    body: {
      name,
      typeId: types[0].id,
      description: 'Espacio creado por las pruebas E2E de Selenium.',
      capacity: 6,
      pricePerHour: 99000,
      regionId: region.id,
      communeId: commune.id,
      address: 'Avenida de Prueba 123',
    },
  });
  const rules = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: '09:00', endTime: '21:00' }));
  await request('PUT', `/spaces/${space.id}/schedule`, { token, body: { rules } });
  return space;
}

/** Sube una foto al espacio (multipart, campo `file`). */
async function uploadPhoto(token, spaceId) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(PHOTO_PATH)], { type: 'image/png' }), 'espacio.png');
  const response = await fetch(`${API_URL}/api/spaces/${spaceId}/photos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!response.ok) throw new Error(`POST /spaces/${spaceId}/photos respondió ${response.status}: ${await response.text()}`);
  return response.json();
}

/** Crea y publica un espacio completo del propietario; las pruebas lo usan en vez de modificar los del seed. */
async function createPublishedSpace(token, name) {
  const space = await createCompleteDraft(token, name);
  await uploadPhoto(token, space.id);
  return request('POST', `/spaces/${space.id}/publish`, { token });
}

module.exports = {
  request, uniqueEmail, login, sessionFor, createUser, createDraftSpace, createCompleteDraft, uploadPhoto,
  createPublishedSpace, PHOTO_PATH, TEST_COMMUNE,
};
