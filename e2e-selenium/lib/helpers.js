const { By, until, Key } = require('selenium-webdriver');
const { BASE_URL, WAIT_MS, TOKEN_KEY, SEED_PASSWORD } = require('./config');
const api = require('./api');

/** Literal de XPath seguro aunque el texto tenga comillas simples. */
const literal = (text) => (text.includes("'") ? `concat('${text.split("'").join(`', "'", '`)}')` : `'${text}'`);

/** Elemento visible: espera a que exista y se muestre. */
async function visible(driver, locator, timeout = WAIT_MS) {
  const element = await driver.wait(until.elementLocated(locator), timeout, `No apareció ${locator}`);
  await driver.wait(until.elementIsVisible(element), timeout, `No se hizo visible ${locator}`);
  return element;
}

/** Clic con scroll previo; reintenta si el elemento se vuelve a dibujar justo antes de tocarlo. */
async function click(driver, locator, timeout = WAIT_MS) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const element = await visible(driver, locator, Math.max(500, deadline - Date.now()));
      await driver.wait(until.elementIsEnabled(element), 2000);
      await driver.executeScript('arguments[0].scrollIntoView({ block: "center" })', element);
      await element.click();
      return;
    } catch (error) {
      lastError = error;
      await driver.sleep(150);
    }
  }
  throw lastError;
}

/** Escribe en un campo reemplazando lo que tenga. */
async function type(driver, locator, text) {
  const element = await visible(driver, locator);
  await element.click();
  await element.sendKeys(Key.chord(Key.CONTROL, 'a'), Key.BACK_SPACE);
  if (text) await element.sendKeys(text);
}

// Localizadores por lo que ve la persona: nombre del campo, texto del botón o del encabezado.
const byName = (name) => By.css(`[name="${name}"]`);
const button = (text) => By.xpath(`//button[normalize-space(.)=${literal(text)}]`);
const link = (text) => By.xpath(`//a[normalize-space(.)=${literal(text)}]`);
const heading = (level, text) => By.xpath(`//h${level}[normalize-space(.)=${literal(text)}]`);
const textOf = (text) => By.xpath(`//*[contains(normalize-space(text()), ${literal(text)})]`);
const ariaLabel = (label) => By.xpath(`//*[@aria-label=${literal(label)}]`);
/** Campo asociado a una etiqueta visible (`<label for>`), para los campos que no tienen `name`. */
const field = (label) => By.xpath(`//*[@id=//label[starts-with(normalize-space(.), ${literal(label)})]/@for]`);

/** Ruta de la app, sin hardcodear el host. */
const open = (driver, route = '/') => driver.get(`${BASE_URL}${route}`);

/** Ruta actual (path + query), útil para comprobar redirecciones. */
async function currentPath(driver) {
  const url = new URL(await driver.getCurrentUrl());
  return url.pathname + url.search;
}

/**
 * Texto de todos los elementos que coinciden con el localizador. Si React vuelve a dibujar la lista mientras se lee
 * (por ejemplo, al llegar los resultados de una búsqueda), Selenium pierde la referencia y lanza
 * StaleElementReferenceError: en ese caso vuelve a buscar los elementos, hasta 5 veces.
 */
async function texts(driver, locator, tries = 5) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const elements = await driver.findElements(locator);
      return await Promise.all(elements.map((element) => element.getText()));
    } catch (error) {
      if (error.name !== 'StaleElementReferenceError' || attempt >= tries) throw error;
      await driver.sleep(200);
    }
  }
}

const waitForPath = (driver, pattern, timeout = WAIT_MS) =>
  driver.wait(async () => pattern.test(await currentPath(driver)), timeout, `La ruta no coincide con ${pattern}`);

/** Inicia sesión por la pantalla de login y espera a ver el botón «Salir» del menú. */
async function loginViaUi(driver, email, password = SEED_PASSWORD) {
  await open(driver, '/login');
  await type(driver, byName('email'), email);
  await type(driver, byName('password'), password);
  await click(driver, button('Ingresar'));
  await visible(driver, button('Salir'));
}

/** Deja la sesión abierta sin pasar por el formulario (para las pruebas que no son del login). */
async function loginViaApi(driver, email, password = SEED_PASSWORD) {
  const { accessToken } = await api.sessionFor(email, password);
  await open(driver, '/');
  await driver.executeScript(`localStorage.setItem('${TOKEN_KEY}', arguments[0])`, accessToken);
  await open(driver, '/');
  await visible(driver, button('Salir'));
}

module.exports = {
  By, until, Key, literal, visible, click, type, byName, button, link, heading, textOf, ariaLabel, field,
  open, currentPath, waitForPath, texts, loginViaUi, loginViaApi, api,
};
