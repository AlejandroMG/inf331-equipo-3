import { defineConfig, devices } from '@playwright/test'

// Puerto propio para el E2E: así no se reutiliza por error un `npm run dev` en 5173 que apunte al back real.
const PORT = 5180
const baseURL = `http://localhost:${PORT}`
const isCI = Boolean(process.env.CI)

/**
 * E2E con navegador (F-10). Por ahora solo hay un smoke test contra Vite con la API simulada por MSW
 * (VITE_USE_MOCKS=true), así que no necesita el back ni la base de datos. Ver docs/plan-de-pruebas.md.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // En el CI falla si quedó un test.only olvidado.
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    // La traza se guarda al reintentar un test que falló; se abre con `npx playwright show-trace`.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: baseURL,
    // En local reutiliza el servidor si ya está levantado en ese puerto; en el CI siempre levanta uno nuevo.
    reuseExistingServer: !isCI,
    timeout: 120_000,
    // Las variables del proceso ganan a las del .env: MSW responde la API y las llamadas van al mismo origen.
    env: { VITE_USE_MOCKS: 'true', VITE_API_URL: baseURL },
  },
})
