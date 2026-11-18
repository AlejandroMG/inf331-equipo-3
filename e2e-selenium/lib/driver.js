const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { HEADLESS } = require('./config');

/** Crea un Chrome nuevo. Selenium Manager descarga el chromedriver que corresponda si no está instalado. */
async function createDriver() {
  const options = new chrome.Options();
  if (HEADLESS) options.addArguments('--headless=new');
  // Las dos primeras son necesarias en los runners de CI (contenedores sin sandbox y con /dev/shm chico).
  options.addArguments('--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1280,900', '--lang=es-CL');
  // Deja los errores de la consola del navegador disponibles para el reporte de fallas.
  options.setLoggingPrefs({ browser: 'ALL' });
  const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
  await driver.manage().setTimeouts({ implicit: 0, pageLoad: 30000, script: 15000 });
  return driver;
}

module.exports = { createDriver };
