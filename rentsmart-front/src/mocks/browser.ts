import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

/** Service worker de MSW para el navegador: se activa con VITE_USE_MOCKS=true (ver main.tsx). */
export const worker = setupWorker(...handlers)
