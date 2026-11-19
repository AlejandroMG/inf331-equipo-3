const assert = require('node:assert/strict');
const { By, visible, click, type, byName, button, heading, textOf, open, loginViaApi, api } = require('../lib/helpers');
const { useBrowser } = require('../lib/session');

// Favoritos (BU-08) y perfil (CU-06): flujos de una persona con sesión sobre sus propios datos.

describe('Favoritos y perfil', function () {
  const browser = useBrowser();
  // Cuenta propia del archivo: las pruebas no modifican a los usuarios del seed. Se crea una sola vez para gastar un solo
  // inicio de sesión del límite de la API.
  let user;

  before(async function () {
    user = await api.createUser('Nombre Original');
  });

  it('FAV-01 guardar un espacio en favoritos lo muestra en «Mis favoritos» y se puede quitar', async function () {
    const { driver } = browser;
    await loginViaApi(driver, user.email, user.password);
    await open(driver, '/spaces/seed-space-4');
    const save = By.xpath('//button[normalize-space(.)="Guardar en favoritos"]');
    const pressed = async () => (await (await driver.findElement(save)).getAttribute('aria-pressed')) === 'true';
    assert.equal(await (await visible(driver, save)).getAttribute('aria-pressed'), 'false');

    await click(driver, save);
    await driver.wait(pressed, 10000, 'El favorito no quedó marcado');
    await open(driver, '/favorites');
    await visible(driver, heading(1, 'Mis favoritos'));
    await visible(driver, By.xpath('//a[@href="/spaces/seed-space-4"]'));

    await open(driver, '/spaces/seed-space-4');
    await click(driver, save);
    await driver.wait(async () => !(await pressed()), 10000, 'El favorito no se quitó');
    await open(driver, '/favorites');
    await visible(driver, heading(2, 'Todavía no tienes favoritos'));
  });

  it('PRF-01 la persona edita su nombre en «Mi perfil» y el cambio queda guardado', async function () {
    const { driver } = browser;
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
