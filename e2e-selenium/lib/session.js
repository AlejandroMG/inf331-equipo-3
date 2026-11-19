const { createDriver } = require('./driver');
const { BASE_URL, TOKEN_KEY } = require('./config');

/** Navegador del archivo de pruebas en curso; lo usa el hook que guarda la evidencia al fallar. */
const current = { driver: null };

/**
 * Registra los hooks de Mocha para que cada archivo de pruebas tenga su propio Chrome y cada prueba parta sin sesión.
 * Se llama dentro de un `describe`: `const browser = useBrowser();` y después `browser.driver` en cada prueba.
 */
function useBrowser() {
  const holder = {
    get driver() {
      return current.driver;
    },
  };

  before(async function () {
    current.driver = await createDriver();
  });

  beforeEach(async function () {
    // El token vive en localStorage, que solo se puede borrar estando en el origen de la app.
    await current.driver.get(`${BASE_URL}/`);
    await current.driver.executeScript(`try { localStorage.removeItem('${TOKEN_KEY}'); localStorage.clear(); } catch (e) {}`);
  });

  after(async function () {
    if (current.driver) await current.driver.quit();
    current.driver = null;
  });

  return holder;
}

module.exports = { useBrowser, current };
