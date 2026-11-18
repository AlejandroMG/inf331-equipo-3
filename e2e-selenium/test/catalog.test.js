const assert = require('node:assert/strict');
const { By, until, visible, click, type, button, heading, open, currentPath, waitForPath } = require('../lib/helpers');
const { useBrowser } = require('../lib/session');

// Catálogo público (BU-01 a BU-04): lo ve cualquier persona, sin sesión. El seed deja al menos 10 espacios activos.

describe('Catálogo y búsqueda', function () {
  const browser = useBrowser();

  const cardTitles = async () => {
    const titles = await browser.driver.findElements(By.css('a[href^="/spaces/"] h3'));
    return Promise.all(titles.map((title) => title.getText()));
  };

  /** Espera a que el catálogo termine de cargar y devuelve los nombres de los espacios visibles. */
  async function loadedCards() {
    await visible(browser.driver, heading(2, 'Espacios disponibles'));
    await browser.driver.wait(until.elementLocated(By.css('h3')), 10000);
    return cardTitles();
  }

  it('CAT-01 la página de inicio muestra el catálogo con los espacios del seed', async function () {
    const { driver } = browser;
    await open(driver, '/');

    await visible(driver, heading(1, 'Encuentra el espacio justo, por hora o por día'));
    const titles = await loadedCards();
    assert.ok(titles.length >= 10, `se esperaban al menos 10 espacios y hay ${titles.length}`);
    assert.match(await driver.getTitle(), /RentSmart/);
  });

  it('CAT-02 buscar por texto deja solo los espacios que coinciden', async function () {
    const { driver } = browser;
    await open(driver, '/');
    const all = await loadedCards();

    await type(driver, By.css('input[type="search"]'), 'Las Condes');
    await click(driver, button('Buscar'));

    await waitForPath(driver, /[?&]q=/);
    await driver.wait(async () => {
      const titles = await cardTitles();
      return titles.length > 0 && titles.length < all.length;
    }, 10000, 'El catálogo no se acotó con la búsqueda');
    // La búsqueda mira el nombre, el tipo y la comuna: cada tarjeta debe mencionar «Las Condes» en alguno de ellos.
    const cards = await Promise.all((await driver.findElements(By.css('a[href^="/spaces/"]'))).map((card) => card.getText()));
    assert.ok(cards.every((text) => text.includes('Las Condes')), `Resultados fuera de la búsqueda: ${cards.join(' | ')}`);
  });

  it('CAT-03 una búsqueda sin coincidencias avisa que no hay resultados', async function () {
    const { driver } = browser;
    await open(driver, '/');
    await loadedCards();

    await type(driver, By.css('input[type="search"]'), 'zzz-no-existe-xyz');
    await click(driver, button('Buscar'));

    await visible(driver, heading(3, 'No encontramos espacios con esos filtros'));
    assert.equal((await cardTitles()).length, 0);
  });

  it('CAT-04 filtrar por tipo de espacio reduce el listado y se refleja en la URL', async function () {
    const { driver } = browser;
    await open(driver, '/');
    const all = await loadedCards();

    const group = By.css('[role="group"][aria-label="Tipo de espacio"]');
    await visible(driver, group);
    // El primer chip después de «Todos» es un tipo concreto.
    const chips = await driver.findElements(By.css('[role="group"][aria-label="Tipo de espacio"] button'));
    await chips[1].click();

    await waitForPath(driver, /[?&]type/);
    await driver.wait(async () => {
      const titles = await cardTitles();
      return titles.length > 0 && titles.length < all.length;
    }, 10000, 'El filtro por tipo no acotó el catálogo');
  });

  it('CAT-05 ordenar por precio de menor a mayor cambia el orden del listado', async function () {
    const { driver } = browser;
    await open(driver, '/');
    await loadedCards();

    const select = await visible(driver, By.xpath('//label[normalize-space(.)="Ordenar por"]/following::select[1]'));
    await select.sendKeys('Precio por hora: menor a mayor');

    await waitForPath(driver, /[?&]sort=price_asc/);
    // Lee el precio por hora de cada tarjeta, en el orden en que aparecen, y comprueba que no baja: no depende de los
    // precios que tenga el seed.
    const hourlyPrices = async () => {
      const texts = await Promise.all((await driver.findElements(By.css('a[href^="/spaces/"]'))).map((card) => card.getText()));
      return texts.map((text) => text.match(/\$\s?([\d.]+)\s*\/\s*hora/)).filter(Boolean).map((match) => Number(match[1].replace(/\./g, '')));
    };
    await driver.wait(async () => {
      const prices = await hourlyPrices();
      return prices.length >= 2 && prices.every((price, index) => index === 0 || prices[index - 1] <= price);
    }, 10000, 'Los precios por hora no quedaron de menor a mayor');
  });

  it('CAT-06 desde el catálogo se abre el detalle de un espacio con su reserva', async function () {
    const { driver } = browser;
    await open(driver, '/');
    const titles = await loadedCards();

    await click(driver, By.xpath(`//a[.//h3[normalize-space(.)="${titles[0]}"]]`));

    await waitForPath(driver, /^\/spaces\//);
    await visible(driver, heading(1, titles[0]));
    await visible(driver, By.css('aside[aria-label="Reservar"]'));
    assert.equal(await driver.getTitle(), `${titles[0]} · RentSmart`);
  });

  it('CAT-07 una ruta que no existe muestra la página de error', async function () {
    const { driver } = browser;
    await open(driver, '/esta-pagina-no-existe');

    await visible(driver, heading(1, 'Título que no existe (falla a propósito para la evidencia)'));
    assert.equal(await currentPath(driver), '/esta-pagina-no-existe');
  });
});
