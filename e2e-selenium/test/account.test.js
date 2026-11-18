const assert = require('node:assert/strict');
const { By, visible, click, type, byName, button, heading, textOf, open, loginViaApi, api } = require('../lib/helpers');
const { USERS } = require('../lib/config');
const { useBrowser } = require('../lib/session');

// Favoritos (BU-08) y perfil (CU-06): flujos de una persona con sesión sobre sus propios datos.

describe('Favoritos y perfil', function () {
  const browser = useBrowser();

  it('FAV-01 guardar un espacio en favoritos lo muestra en «Mis favoritos» y se puede quitar', async function () {
    const { driver } = browser;
    await loginViaApi(driver, USERS.renter);
    await open(driver, '/spaces/seed-space-4');
    const save = By.xpath('//button[normalize-space(.)="Guardar en favoritos"]');

    try {
      const toggle = await visible(driver, save);
      if ((await toggle.getAttribute('aria-pressed')) === 'true') await toggle.click();
      await driver.wait(async () => (await (await driver.findElement(save)).getAttribute('aria-pressed')) === 'false', 10000);

      await click(driver, save);
      await driver.wait(async () => (await (await driver.findElement(save)).getAttribute('aria-pressed')) === 'true', 10000, 'El favorito no quedó marcado');

      await open(driver, '/favorites');
      await visible(driver, heading(1, 'Mis favoritos'));
      await visible(driver, By.xpath('//a[@href="/spaces/seed-space-4"]'));
    } finally {
      // Deja la cuenta del seed como estaba.
      await open(driver, '/spaces/seed-space-4');
      const toggle = await visible(driver, save);
      if ((await toggle.getAttribute('aria-pressed')) === 'true') await toggle.click();
    }
  });

  it('PRF-01 la persona edita su nombre en «Mi perfil» y el cambio queda guardado', async function () {
    const { driver } = browser;
    // Cuenta propia de la prueba: así no se modifica a los usuarios del seed que usan las otras pruebas.
    const user = await api.createUser('Nombre Original');
    await loginViaApi(driver, user.email, user.password);
    await open(driver, '/profile');
    await visible(driver, heading(1, 'Mi perfil'));

    await type(driver, byName('name'), 'Nombre Editado E2E');
    await click(driver, button('Guardar cambios'));
    await visible(driver, textOf('Tus cambios se guardaron.'));

    await driver.navigate().refresh();
    await visible(driver, heading(1, 'Mi perfil'));
    await driver.wait(async () => (await (await driver.findElement(byName('name'))).getAttribute('value')) === 'Nombre Editado E2E', 10000, 'El nombre no persistió');
    assert.equal(await (await driver.findElement(By.css('input[type="email"]'))).getAttribute('value'), user.email);
  });
});
