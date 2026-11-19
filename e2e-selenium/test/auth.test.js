const assert = require('node:assert/strict');
const { By, visible, click, type, byName, button, heading, textOf, open, currentPath, waitForPath, loginViaUi, loginViaApi } = require('../lib/helpers');
const { USERS, SEED_PASSWORD } = require('../lib/config');
const { uniqueEmail } = require('../lib/api');
const { useBrowser } = require('../lib/session');

// Cuentas, sesión y permisos (CU-01 a CU-05): registro con validaciones, login, logout y rutas protegidas.

describe('Cuentas, sesión y permisos', function () {
  const browser = useBrowser();

  it('AUT-01 registrarse con campos vacíos muestra los errores de validación y no envía nada', async function () {
    const { driver } = browser;
    await open(driver, '/register');
    await visible(driver, heading(1, 'Crea tu cuenta'));

    await click(driver, button('Crear cuenta'));

    await visible(driver, textOf('El nombre es obligatorio.'));
    await visible(driver, textOf('Ingresa un email válido.'));
    await visible(driver, textOf('La contraseña debe tener al menos 8 caracteres.'));
    assert.equal(await currentPath(driver), '/register');
  });

  it('AUT-02 registrarse con datos válidos crea la cuenta y lleva al login con el email cargado', async function () {
    const { driver } = browser;
    const email = uniqueEmail('registro');
    await open(driver, '/register');

    await type(driver, byName('name'), 'Camila Prueba');
    await type(driver, byName('email'), email);
    await type(driver, byName('password'), SEED_PASSWORD);
    await click(driver, button('Crear cuenta'));

    await waitForPath(driver, /^\/login/);
    await visible(driver, textOf('Cuenta creada. Ahora inicia sesión.'));
    assert.equal(await (await visible(driver, byName('email'))).getAttribute('value'), email);
  });

  it('AUT-03 registrarse con un email ya usado muestra el error en el campo', async function () {
    const { driver } = browser;
    await open(driver, '/register');

    await type(driver, byName('name'), 'Persona Repetida');
    await type(driver, byName('email'), USERS.renter);
    await type(driver, byName('password'), SEED_PASSWORD);
    await click(driver, button('Crear cuenta'));

    await visible(driver, By.css('[role="alert"], [id$="-error"], p.text-accent-ink'));
    assert.equal(await currentPath(driver), '/register');
  });

  it('AUT-04 iniciar sesión con una contraseña incorrecta muestra un error y no entra', async function () {
    const { driver } = browser;
    await open(driver, '/login');

    await type(driver, byName('email'), USERS.renter);
    await type(driver, byName('password'), 'ContraseñaMala1');
    await click(driver, button('Ingresar'));

    await visible(driver, textOf('Email o contraseña incorrectos.'));
    assert.equal(await currentPath(driver), '/login');
    assert.equal((await driver.findElements(button('Salir'))).length, 0);
  });

  it('AUT-05 iniciar sesión con el usuario del seed entra y cerrar sesión vuelve a la vista pública', async function () {
    const { driver } = browser;

    await loginViaUi(driver, USERS.renter);
    await waitForPath(driver, /^\/$/);
    await visible(driver, textOf('Hola, Andrés Arrendatario.'));

    await click(driver, button('Salir'));

    await visible(driver, By.xpath('//a[normalize-space(.)="Ingresar"]'));
    assert.equal((await driver.findElements(button('Salir'))).length, 0);
  });

  it('AUT-06 una ruta protegida sin sesión redirige al login y, al entrar, vuelve a esa ruta', async function () {
    const { driver } = browser;
    await open(driver, '/profile');

    await waitForPath(driver, /^\/login/);
    await visible(driver, heading(1, 'Iniciar sesión'));

    await type(driver, byName('email'), USERS.renter);
    await type(driver, byName('password'), SEED_PASSWORD);
    await click(driver, button('Ingresar'));

    await waitForPath(driver, /^\/profile/);
    await visible(driver, heading(1, 'Mi perfil'));
  });

  it('AUT-07 una cuenta sin rol de administrador no accede al panel de administración', async function () {
    const { driver } = browser;
    await loginViaApi(driver, USERS.renter);

    await open(driver, '/admin/spaces');

    await visible(driver, heading(1, 'No tienes acceso a esta página'));
    await visible(driver, textOf('Error 403'));
  });

  it('AUT-08 la cuenta administradora sí accede a la moderación de espacios', async function () {
    const { driver } = browser;
    await loginViaApi(driver, USERS.admin);

    await open(driver, '/admin/spaces');

    await visible(driver, By.css('h1'));
    assert.equal(await currentPath(driver), '/admin/spaces');
    assert.equal((await driver.findElements(heading(1, 'No tienes acceso a esta página'))).length, 0);
  });
});
