const assert = require('node:assert/strict');
const { By, until, visible, click, heading, ariaLabel, open, loginViaApi, api } = require('../lib/helpers');
const { USERS } = require('../lib/config');
const { useBrowser } = require('../lib/session');

// Panel del propietario (PN-01, ES-06, ES-08): ver sus espacios, activarlos o desactivarlos y eliminar un borrador.

describe('Panel del propietario', function () {
  const browser = useBrowser();

  it('OWN-01 «Mis espacios» lista los espacios del propietario y su resumen', async function () {
    const { driver } = browser;
    await loginViaApi(driver, USERS.owner);

    await open(driver, '/owner/spaces');

    await visible(driver, heading(1, 'Mis espacios'));
    await visible(driver, By.css('ul[aria-label="Resumen"]'));
    await visible(driver, By.css('[role="switch"]'));
    assert.ok((await driver.findElements(By.css('[role="switch"]'))).length >= 10);
  });

  it('OWN-02 desactivar un espacio lo saca del catálogo público y volver a activarlo lo devuelve', async function () {
    const { driver } = browser;
    await loginViaApi(driver, USERS.owner);
    await open(driver, '/owner/spaces');

    // Se usa el último espacio del seed y se deja activo al terminar, pase lo que pase.
    const target = By.xpath('//li[.//a[@aria-label="Editar Oficina o cowork San Miguel 10"]]//button[@role="switch"]');
    const toggle = await visible(driver, target);
    assert.equal(await toggle.getAttribute('aria-checked'), 'true');

    try {
      await click(driver, target);
      await click(driver, By.xpath('//dialog[@open]//button[normalize-space(.)="Desactivar"]'));
      await driver.wait(async () => (await (await driver.findElement(target)).getAttribute('aria-checked')) === 'false', 10000, 'El espacio no quedó inactivo');

      await open(driver, '/');
      await visible(driver, heading(2, 'Espacios disponibles'));
      await driver.wait(until.elementLocated(By.css('a[href^="/spaces/"] h3')), 10000);
      const names = await Promise.all((await driver.findElements(By.css('a[href^="/spaces/"] h3'))).map((el) => el.getText()));
      assert.ok(!names.includes('Oficina o cowork San Miguel 10'), 'El espacio inactivo sigue en el catálogo');
    } finally {
      await open(driver, '/owner/spaces');
      const again = await visible(driver, target);
      if ((await again.getAttribute('aria-checked')) === 'false') {
        await click(driver, target);
        await driver.wait(async () => (await (await driver.findElement(target)).getAttribute('aria-checked')) === 'true', 10000);
      }
    }

    await open(driver, '/');
    await visible(driver, By.xpath('//a[@href="/spaces/seed-space-10"]'));
  });

  it('OWN-03 un borrador aparece en «Mis espacios» y se puede eliminar con confirmación', async function () {
    const { driver } = browser;
    const name = `Borrador E2E ${Date.now()}`;
    const { accessToken } = await api.sessionFor(USERS.owner);
    await api.createDraftSpace(accessToken, name);
    await loginViaApi(driver, USERS.owner);
    await open(driver, '/owner/spaces');

    await visible(driver, ariaLabel(`Completar ${name}`));
    await click(driver, ariaLabel(`Eliminar ${name}`));
    await visible(driver, By.css('dialog[open]'));
    await click(driver, By.xpath('//dialog[@open]//button[normalize-space(.)="Eliminar"]'));

    await driver.wait(async () => (await driver.findElements(ariaLabel(`Completar ${name}`))).length === 0, 10000, 'El borrador no se eliminó');
  });
});
