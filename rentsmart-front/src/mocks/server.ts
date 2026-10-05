import { setupServer } from 'msw/node'
import { handlers } from './handlers'

/** Servidor de MSW para los tests (Node). */
export const server = setupServer(...handlers)
