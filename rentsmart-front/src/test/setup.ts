import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetMockDrafts } from '../mocks/handlers'
import { server } from '../mocks/server'

// Una petición sin handler es un error del test: no debe salir a la red.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockDrafts()
  server.events.removeAllListeners()
  cleanup()
  localStorage.clear()
})
afterAll(() => server.close())

// jsdom no implementa <dialog>.showModal() ni close(): se simulan con el atributo `open`.
HTMLDialogElement.prototype.showModal = function showModal() {
  this.setAttribute('open', '')
}
HTMLDialogElement.prototype.close = function close() {
  if (!this.hasAttribute('open')) return
  this.removeAttribute('open')
  this.dispatchEvent(new Event('close'))
}
