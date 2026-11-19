const fs = require('node:fs');
const path = require('node:path');
const { current } = require('./session');

const OUT_DIR = path.join(__dirname, '..', 'screenshots');

const slug = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);

/**
 * Evidencia de las fallas (Anexo A de la pauta): cuando una prueba falla guarda un screenshot, el HTML de la página y
 * el log de la consola del navegador. En el CI esa carpeta se sube como artefacto del job.
 */
exports.mochaHooks = {
  async afterEach() {
    const test = this.currentTest;
    const driver = current.driver;
    if (!test || test.state !== 'failed' || !driver) return;

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const base = path.join(OUT_DIR, slug(test.fullTitle()));
    try {
      fs.writeFileSync(`${base}.png`, await driver.takeScreenshot(), 'base64');
      fs.writeFileSync(`${base}.html`, await driver.getPageSource());
      const url = await driver.getCurrentUrl();
      const logs = await driver.manage().logs().get('browser');
      const lines = [`URL: ${url}`, '', ...logs.map((entry) => `[${entry.level.name}] ${entry.message}`)];
      fs.writeFileSync(`${base}.log`, lines.join('\n'));
      console.log(`      evidencia guardada en screenshots/${path.basename(base)}.{png,html,log}`);
    } catch (error) {
      console.log(`      no se pudo guardar la evidencia: ${error.message}`);
    }
  },
};
