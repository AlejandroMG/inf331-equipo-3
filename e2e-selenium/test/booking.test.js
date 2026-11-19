const assert = require('node:assert/strict');
const { By, until, visible, click, button, heading, textOf, open, currentPath, waitForPath, loginViaApi } = require('../lib/helpers');
const { USERS } = require('../lib/config');
const { useBrowser } = require('../lib/session');

// Reservas (RE-02, RE-03): elegir día y horas en el detalle, reservar y ver la reserva pendiente de pago.
// El back del E2E corre sin STRIPE_SECRET_KEY, así que el checkout provisorio lleva a la página de la reserva.

const SPACE = '/spaces/seed-space-3';
const WIDGET = 'aside[aria-label="Reservar"]';
const HOUR_BUTTONS = `${WIDGET} fieldset button[aria-pressed]`;

describe('Reservas', function () {
  const browser = useBrowser();

  /** Elige un día y una hora al azar entre los libres, para que repetir la corrida contra la misma BD no choque. */
  async function pickRandomSlot() {
    const { driver } = browser;
    await visible(driver, By.css(`${WIDGET} select`));
    const days = await driver.findElements(By.css(`${WIDGET} select option`));
    assert.ok(days.length > 0, 'El espacio no tiene días reservables');
    await days[Math.floor(Math.random() * days.length)].click();

    await driver.wait(until.elementLocated(By.css(HOUR_BUTTONS)), 10000, 'No aparecieron las horas libres');
    const hours = await driver.findElements(By.css(HOUR_BUTTONS));
    const hour = hours[Math.floor(Math.random() * hours.length)];
    await driver.executeScript('arguments[0].scrollIntoView({ block: "center" })', hour);
    await hour.click();
    assert.equal(await hour.getAttribute('aria-pressed'), 'true');
  }

  it('BOK-01 sin sesión, elegir horas y reservar lleva al login', async function () {
    const { driver } = browser;
    await open(driver, SPACE);
    await visible(driver, By.css(WIDGET));

    await pickRandomSlot();
    await visible(driver, By.css(`${WIDGET} section[aria-label="Desglose del precio"]`));
    await click(driver, By.xpath(`//aside[@aria-label="Reservar"]//button[normalize-space(.)="Reservar"]`));

    await waitForPath(driver, /^\/login/);
    await visible(driver, heading(1, 'Iniciar sesión'));
  });

  it('BOK-02 el arrendatario reserva un bloque y ve su reserva pendiente de pago con el desglose', async function () {
    const { driver } = browser;
    await loginViaApi(driver, USERS.renter);

    // Si el bloque al azar ya estaba tomado por otra corrida, la API responde 409 y se prueba con otro.
    let booked = false;
    for (let attempt = 1; attempt <= 6 && !booked; attempt++) {
      await open(driver, SPACE);
      await pickRandomSlot();
      const summary = await visible(driver, By.css(`${WIDGET} section[aria-label="Desglose del precio"]`));
      assert.match(await summary.getText(), /Total/);
      await click(driver, By.xpath(`//aside[@aria-label="Reservar"]//button[normalize-space(.)="Reservar"]`));
      try {
        await waitForPath(driver, /^\/bookings\//, 8000);
        booked = true;
      } catch {
        // sigue en el detalle con el aviso de conflicto: otro intento
      }
    }
    assert.ok(booked, 'No se logró reservar ningún bloque tras 6 intentos');

    await visible(driver, textOf('Tu reserva en'));
    await visible(driver, By.xpath('//*[normalize-space(.)="Pendiente de pago"]'));
    await visible(driver, By.css('section[aria-labelledby="booking-amounts"]'));
    assert.match(await currentPath(driver), /^\/bookings\/[\w-]+$/);
  });

  it('BOK-03 la reserva de otra persona no se puede ver sin sesión', async function () {
    const { driver } = browser;
    await open(driver, '/bookings/00000000-0000-0000-0000-000000000000');

    await waitForPath(driver, /^\/login/);
    assert.equal((await driver.findElements(textOf('Tu reserva en'))).length, 0);
    await visible(driver, button('Ingresar'));
  });
});
