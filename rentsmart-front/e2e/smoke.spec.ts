import { expect, test } from '@playwright/test'

// Smoke test (F-10): la app arranca en un navegador real y muestra el catálogo que entrega MSW (src/mocks/catalog-data.ts).
// No reemplaza a los tests de Vitest; solo confirma que el build de Vite, el enrutador y los mocks funcionan juntos.

test.describe('smoke', () => {
  test('la página de inicio muestra el catálogo con los espacios simulados', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle('Espacios para arrendar · RentSmart')
    await expect(page.getByRole('heading', { level: 1, name: 'Encuentra el espacio justo, por hora o por día' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Espacios disponibles' })).toBeVisible()

    // Los mocks traen 14 espacios y el catálogo muestra 12 por página.
    await expect(page.getByText('14 espacios')).toBeVisible()
    await expect(page.getByRole('heading', { level: 3, name: 'Sala Alameda' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 3, name: 'Cancha techada Las Condes' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Paginación' })).toBeVisible()
  })

  test('la segunda página del catálogo muestra el resto de los espacios', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: 'Página 2' }).click()

    await expect(page).toHaveURL(/[?&]page=2/)
    await expect(page.getByRole('heading', { level: 3, name: 'Taller de cerámica' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 3, name: 'Sala Alameda' })).toHaveCount(0)
  })

  test('desde el catálogo se abre el detalle de un espacio', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: /Estudio Luz Norte/ }).click()

    await expect(page).toHaveURL(/\/spaces\/seed-space-2$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Estudio Luz Norte' })).toBeVisible()
    await expect(page).toHaveTitle('Estudio Luz Norte · RentSmart')
  })
})
