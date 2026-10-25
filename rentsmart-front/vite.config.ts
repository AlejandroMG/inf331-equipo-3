import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // En desarrollo, con VITE_API_URL=http://localhost:5173 las llamadas a /api pasan por aquí hacia la API
    // y el navegador no necesita CORS (que llega con CU-05).
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // Los estilos no importan en los tests y evitan procesar Tailwind.
    css: false,
    // e2e/ son los tests de Playwright (npm run test:e2e): corren en un navegador real, no en Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    // Los tests del formulario por pasos escriben y navegan con userEvent; en un runner lento superan los 5 s por defecto.
    testTimeout: 15000,
  },
})
