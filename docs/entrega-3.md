# Entrega 3: pruebas de interfaz con Selenium

Documento de la Entrega 3 del ramo INF331 (equipo 3). Sigue el orden del Anexo B de la pauta. La misma información se publica en la página «Entrega 3» de la Wiki.

## Objetivo de la Entrega 3

Sumar pruebas de interfaz (E2E/UI) a RentSmart, que corran solas dentro del pipeline de la Entrega 2 y dejen evidencia clara de cada ejecución. Queda así:

- 23 pruebas E2E/UI con **Selenium WebDriver**, sobre el stack real (base de datos, API y front), en Chrome headless.
- Un job nuevo, «E2E (Selenium)», en el workflow de GitHub Actions que levanta ese stack, corre las pruebas y falla el pipeline si una prueba falla.
- Reportes, logs y screenshots de las fallas como artefactos descargables, y un resumen en cada ejecución.
- Aviso del resultado al canal de Discord del equipo.

## Herramienta E2E elegida

**Selenium WebDriver** con JavaScript y **Mocha** como ejecutor.

- **Por qué Selenium:** es la herramienta por defecto de la pauta. Playwright, la otra que conocíamos, ya se usó en la Entrega 2 (smoke test), y la pauta solo permite una alternativa si no se usó antes.
- **Por qué JavaScript y Mocha:** todo el repo es Node, así que el equipo no suma otro lenguaje ni otro entorno al CI. Mocha da un ejecutor sencillo con reportes JUnit y HTML.
- **Qué pasa con Playwright:** se mantiene como smoke test rápido contra la API simulada (job «E2E (Playwright)»). Los dos jobs se complementan: el smoke avisa en segundos si la app no arranca y Selenium recorre los flujos completos.

El proyecto está en [`e2e-selenium/`](../e2e-selenium/README.md) y tiene su propio `package.json`.

## Set de pruebas

Hay 23 pruebas en 5 archivos. Cada una es un flujo de usuario, no una prueba unitaria.

| ID | Qué valida |
|---|---|
| **CAT-01** | La página de inicio muestra el catálogo con los espacios del seed |
| **CAT-02** | Buscar por texto deja solo los espacios que coinciden |
| **CAT-03** | Una búsqueda sin coincidencias avisa que no hay resultados |
| **CAT-04** | Filtrar por tipo de espacio reduce el listado y queda en la URL |
| **CAT-05** | Ordenar por precio de menor a mayor cambia el orden |
| **CAT-06** | Desde el catálogo se abre el detalle de un espacio, con su panel de reserva |
| **CAT-07** | Una ruta que no existe muestra la página de error 404 |
| **AUT-01** | Registrarse con campos vacíos muestra los errores y no envía nada |
| **AUT-02** | Registrarse con datos válidos crea la cuenta y lleva al login con el email cargado |
| **AUT-03** | Registrarse con un email ya usado muestra el error |
| **AUT-04** | Iniciar sesión con contraseña incorrecta muestra el error y no entra |
| **AUT-05** | Iniciar sesión con el usuario del seed entra, y «Salir» vuelve a la vista pública |
| **AUT-06** | Una ruta protegida sin sesión redirige al login y, al entrar, vuelve a esa ruta |
| **AUT-07** | Una cuenta sin rol de administrador recibe el 403 en el panel de administración |
| **AUT-08** | La cuenta administradora sí accede a la moderación de espacios |
| **OWN-01** | «Mis espacios» lista los espacios del propietario y su resumen |
| **OWN-02** | Desactivar un espacio lo saca del catálogo público; activarlo lo devuelve |
| **OWN-03** | Un borrador aparece en «Mis espacios» y se elimina con confirmación |
| **BOK-01** | Sin sesión, elegir horas y reservar lleva al login |
| **BOK-02** | El arrendatario reserva un bloque y ve su reserva pendiente de pago con el desglose |
| **BOK-03** | Una reserva no se puede ver sin sesión |
| **FAV-01** | Guardar un espacio en favoritos lo muestra en «Mis favoritos» y se puede quitar |
| **PRF-01** | Editar el nombre en «Mi perfil» queda guardado tras recargar |

**Escenarios críticos cubiertos** (los de la pauta):

| Escenario de la pauta | Pruebas |
|---|---|
| CRUD happy path | OWN-02 y OWN-03 (actualizar estado y eliminar), BOK-02 (crear una reserva), PRF-01 (editar), FAV-01 (crear y quitar) |
| Validaciones y errores | AUT-01, AUT-03, AUT-04, CAT-03, CAT-07 |
| Búsqueda y filtro | CAT-02, CAT-03, CAT-04, CAT-05 |
| Login y permisos | AUT-04 a AUT-08, BOK-01, BOK-03 |
| Navegación clave | CAT-01, CAT-06, OWN-01 |

**Flujo que sustituimos y por qué.** La pauta sugiere «crear → listar → ver detalle → editar → eliminar» sobre una sola entidad. En RentSmart publicar un espacio es un formulario de varios pasos con fotos y ubicación, que ya prueban los tests de Vitest y de integración. Para el E2E se reparte el CRUD en lo que la persona hace de punta a punta: crear un borrador (por API, como dato de partida), verlo en «Mis espacios», cambiarle el estado y eliminarlo, más crear una reserva y editar el perfil.

**Qué no cubre.** El pago con Stripe Checkout y la confirmación automática de la reserva (el back del E2E corre sin `STRIPE_SECRET_KEY`, así que la reserva queda pendiente de pago). Sigue pendiente en [QA-01](https://github.com/AlejandroMG/inf331-equipo-3/issues/64).

## Cómo ejecutar en local

**Requisitos:** Node.js 24.9 o superior, Google Chrome y Docker (o una PostgreSQL 17). Selenium Manager descarga el `chromedriver`.

Los pasos completos (base de datos, back, front y pruebas) están en [`e2e-selenium/README.md`](../e2e-selenium/README.md#cómo-correrlas-en-local). En resumen:

```bash
# base de datos, migraciones y seed; luego el back (3000) y el front compilado (4173)
cd e2e-selenium
npm install
npm test                 # headless
HEADLESS=false npm test  # con el navegador visible
```

| Variable | Por defecto | Para qué |
|---|---|---|
| `BASE_URL` | `http://localhost:4173` | Dónde corre el front |
| `API_URL` | igual a `BASE_URL` | Base de la API para preparar datos |
| `HEADLESS` | `true` | `false` abre el navegador |
| `WAIT_MS` | `10000` | Espera máxima de un elemento |

**Datos de prueba.** El seed del back deja tres usuarios (`admin@`, `propietario@` y `arrendatario@rentsmart.test`, contraseña `Password123`) y 10 espacios activos. Las pruebas crean sus propias cuentas con emails únicos y eligen horarios al azar, así que no dependen del orden ni de corridas anteriores.

## Integración con CI/CD

- **Dónde está:** job `e2e-selenium` («E2E (Selenium)») en [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).
- **Qué lo gatilla:** el mismo workflow del resto del CI: cada push a `main` y `develop` y cada pull request hacia `main`, `develop` o `release/**`.
- **Qué hace**, en orden:
  1. Levanta PostgreSQL 17 como servicio del job.
  2. Instala el back, genera el cliente de Prisma, migra, siembra y compila.
  3. Compila el front con `VITE_API_URL` apuntando a su propio origen.
  4. Arranca la API (3000) y el front con `vite preview` (4173), que reenvía `/api` a la API, y espera a que respondan.
  5. Instala `e2e-selenium` y corre `npm test` en Chrome headless.
  6. Escribe un resumen en la ejecución y sube los artefactos.
- **OK o FAIL:** `npm test` termina con código distinto de cero si falla una prueba; el job queda en rojo y el check del PR también.
- **Variables:** `BASE_URL` (se fija en el workflow), `DATABASE_URL` y `JWT_SECRET` (solo para el CI; no son secretos reales). El secreto `DISCORD_WEBHOOK_URL` es opcional y vive en los secretos del repositorio.
- **Aviso a Discord:** el job `notify` espera a los demás y publica en el canal si el pipeline pasó o falló, con el enlace a la ejecución. Si el secreto no existe, se omite.

## Evidencias

| Evidencia | Dónde |
|---|---|
| Logs del job | Pestaña Actions del repositorio, job «E2E (Selenium)» |
| Resumen de resultados | Resumen de la ejecución («Pruebas E2E con Selenium»: pruebas, pasaron, fallaron, duración) |
| Reporte HTML y JUnit | Artefacto `selenium-report` (`index.html`, `index.json`, `junit.xml`, `api.log`, `front.log`) |
| Screenshots de fallas | Artefacto `selenium-screenshots`: por cada prueba que falla, un `.png`, el `.html` de la página y el `.log` de la consola |
| Aviso en Discord | Canal del equipo |

**Evidencia de una falla.** En el desarrollo de la suite hubo corridas en rojo que dejaron el screenshot, el HTML y el log del navegador de cada prueba que falló; por ejemplo, cuando se agotó el límite de login de la API (ver el problema 1).

**Enlaces a las ejecuciones:** PENDIENTE_ completar con el enlace a una ejecución en verde y a una en rojo hecha a propósito, una vez que el PR de la Entrega 3 corra en GitHub Actions.

## Problemas encontrados y soluciones

| Problema | Solución |
|---|---|
| La pauta pide Jenkins y Slack | Se mantienen las alternativas de la Entrega 2: GitHub Actions y Discord, declaradas en la Wiki |
| Playwright ya se usó en la Entrega 2 y la pauta lo permite solo si no se usó antes | Se usa Selenium para la suite de la entrega y se deja Playwright como smoke test |
| **1.** La API limita el login a 10 intentos por IP cada 15 minutos (CU-05) y las primeras corridas terminaban en `429 Too Many Requests` | Cada usuario inicia sesión por API una sola vez por ejecución y se reutiliza su token; solo las pruebas del formulario de login pasan por la interfaz. Una corrida usa 7 de los 10 intentos |
| Ya había bases de datos de otros proyectos en los puertos 5432 y 5433 | La base de las pruebas usa el puerto 5434 |
| El catálogo vacío y las tarjetas comparten la etiqueta `h3`, y la prueba contaba el aviso como si fuera un espacio | Las tarjetas se identifican como `a[href^="/spaces/"] h3` |
| Después de integrar `develop`, el back no compilaba: faltaba el paquete `stripe` y el cliente de Prisma estaba viejo | `npm ci` y `npx prisma generate` antes de compilar; el job de CI ya lo hace en ese orden |
| Mocha no generaba los reportes JUnit y HTML cuando las opciones del multi-reporter iban dentro de `.mocharc.cjs` | Se pasaron en un archivo aparte, `reporter-config.json` |
| Selenium no tiene `getByRole` como Playwright | Se localiza por el `name` del campo, el texto del botón o encabezado y los `aria-label`, que la interfaz ya trae por accesibilidad |

## Pendientes y mejoras futuras

- Pago con Stripe Checkout y confirmación automática de la reserva en el E2E (QA-01).
- Una variable de entorno para subir el límite de login en el entorno de pruebas, así la suite podría repetirse sin reiniciar la API. Es un cambio en `auth` (módulo de A), por eso no se hizo.
- Publicar un espacio con el formulario completo, con fotos y ubicación.
- Ejecutar las pruebas a 375 px y en otros navegadores.
- Hacer obligatorio «E2E (Selenium)» en el ruleset de `main` cuando lleve unas semanas estable.
- Cancelar una reserva desde la interfaz, cuando exista (PN-03).
