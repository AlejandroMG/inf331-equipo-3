const assert = require('node:assert/strict');
const { By, until, visible, click, type, heading, ariaLabel, field, open, loginViaApi, waitForPath, api } = require('../lib/helpers');
const { USERS } = require('../lib/config');
const { useBrowser } = require('../lib/session');

// Panel del propietario (PN-01, ES-02 a ES-08): ver sus espacios, publicar, editar, activar o desactivar y eliminar.
// Cada prueba crea sus propios espacios por API: los del seed no se modifican.

/** Botón de un paso del formulario de publicar («Información», «Fotos», «Revisar»…). */
const stepButton = (label) => By.xpath(`//ol[@aria-label="Pasos"]//button[contains(normalize-space(.), "${label}")]`);

describe('Panel del propietario', function () {
  const browser = useBrowser();
  let ownerToken;

  before(async function () {
    ownerToken = (await api.sessionFor(USERS.owner)).accessToken;
  });

  /** Nombres de los espacios que muestra el catálogo público. */
  async function catalogNames(driver) {
    await open(driver, '/');
    await visible(driver, heading(2, 'Espacios disponibles'));
    await driver.wait(until.elementLocated(By.css('a[href^="/spaces/"] h3')), 10000);
    return Promise.all((await driver.findElements(By.css('a[href^="/spaces/"] h3'))).map((el) => el.getText()));
  }

  it('OWN-01 «Mis espacios» lista los espacios del propietario y su resumen', async function () {
    const { driver } = browser;
    await loginViaApi(driver, USERS.owner);

    await open(driver, '/owner/spaces');

    await visible(driver, heading(1, 'Mis espacios'));
    await visible(driver, By.css('ul[aria-label="Resumen"]'));
    await visible(driver, By.css('[role="switch"]'));
    assert.ok((await driver.findElements(By.css('[role="switch"]'))).length >= 10);
  });

  it('OWN-02 publicar un borrador desde el formulario: se sube la foto, se publica y aparece en el catálogo', async function () {
    const { driver } = browser;
    const name = `Publicado E2E ${Date.now()}`;
    // El borrador trae todo menos la foto, que es lo que la persona completa en la interfaz.
    const draft = await api.createCompleteDraft(ownerToken, name);
    await loginViaApi(driver, USERS.owner);
    await open(driver, `/publish/${draft.id}`);
    await visible(driver, heading(1, 'Publica tu espacio'));

    await click(driver, stepButton('Fotos'));
    const input = await driver.wait(until.elementLocated(By.css('input[type="file"]')), 10000);
    await input.sendKeys(api.PHOTO_PATH);
    await visible(driver, By.css('img[alt="Foto 1"]'));

    await click(driver, stepButton('Revisar'));
    await visible(driver, heading(2, 'Revisa y publica'));
    await click(driver, By.xpath('//button[normalize-space(.)="Publicar espacio"]'));

    await visible(driver, heading(1, '¡Tu espacio está publicado!'));
    await click(driver, By.xpath('//a[normalize-space(.)="Ver en el catálogo"]'));
    await waitForPath(driver, new RegExp(`^/spaces/${draft.id}$`));
    await visible(driver, heading(1, name));
  });

  it('OWN-03 editar un espacio publicado cambia su nombre en el detalle público', async function () {
    const { driver } = browser;
    const space = await api.createPublishedSpace(ownerToken, `Para editar E2E ${Date.now()}`);
    const newName = `Editado E2E ${Date.now()}`;
    await loginViaApi(driver, USERS.owner);
    await open(driver, '/owner/spaces');

    await click(driver, ariaLabel(`Editar ${space.name}`));
    await visible(driver, heading(1, 'Edita tu espacio'));
    await type(driver, field('Nombre del espacio'), newName);
    // Pasar de paso guarda los cambios del espacio.
    await click(driver, stepButton('Ubicación'));
    await visible(driver, By.xpath('//*[normalize-space(.)="Cambios guardados"]'));

    await open(driver, `/spaces/${space.id}`);
    await visible(driver, heading(1, newName));
  });

  it('OWN-04 desactivar un espacio lo saca del catálogo público y volver a activarlo lo devuelve', async function () {
    const { driver } = browser;
    const space = await api.createPublishedSpace(ownerToken, `Para desactivar E2E ${Date.now()}`);
    await loginViaApi(driver, USERS.owner);
    await open(driver, '/owner/spaces');
    const toggle = By.xpath(`//li[.//a[@aria-label="Editar ${space.name}"]]//button[@role="switch"]`);
    const isChecked = async () => (await (await driver.findElement(toggle)).getAttribute('aria-checked')) === 'true';
    assert.equal(await (await visible(driver, toggle)).getAttribute('aria-checked'), 'true');

    await click(driver, toggle);
    await click(driver, By.xpath('//dialog[@open]//button[normalize-space(.)="Desactivar"]'));
    await driver.wait(async () => !(await isChecked()), 10000, 'El espacio no quedó inactivo');
    // El catálogo muestra los más recientes primero, así que el espacio recién creado estaría en la primera página.
    assert.ok(!(await catalogNames(driver)).includes(space.name), 'El espacio inactivo sigue en el catálogo');

    await open(driver, '/owner/spaces');
    await click(driver, toggle);
    await driver.wait(isChecked, 10000, 'El espacio no volvió a quedar activo');
    assert.ok((await catalogNames(driver)).includes(space.name), 'El espacio activo no volvió al catálogo');
  });

  it('OWN-05 un borrador aparece en «Mis espacios» y se puede eliminar con confirmación', async function () {
    const { driver } = browser;
    const name = `Borrador E2E ${Date.now()}`;
    await api.createDraftSpace(ownerToken, name);
    await loginViaApi(driver, USERS.owner);
    await open(driver, '/owner/spaces');

    await visible(driver, ariaLabel(`Completar ${name}`));
    await click(driver, ariaLabel(`Eliminar ${name}`));
    await visible(driver, By.css('dialog[open]'));
    await click(driver, By.xpath('//dialog[@open]//button[normalize-space(.)="Eliminar"]'));

    await driver.wait(async () => (await driver.findElements(ariaLabel(`Completar ${name}`))).length === 0, 10000, 'El borrador no se eliminó');
  });
});
