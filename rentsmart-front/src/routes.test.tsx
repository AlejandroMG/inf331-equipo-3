import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from './components/ToastProvider'
import { setToken } from './lib/token'
import { routes } from './routes'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )
  return router
}

describe('rutas', () => {
  it('la raíz muestra el catálogo con el layout', () => {
    renderAt('/')

    expect(screen.getByRole('heading', { level: 1, name: 'Espacios disponibles' })).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('el detalle de un espacio es público', async () => {
    renderAt('/spaces/seed-space-1')

    expect(await screen.findByRole('heading', { level: 1, name: 'Sala Alameda' })).toBeInTheDocument()
  })

  it.each(['/publish', '/owner/spaces'])('sin sesión, %s redirige a /login y recuerda la ruta pedida', async (path) => {
    const router = renderAt(path)

    expect(await screen.findByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.state).toEqual({ from: path })
  })

  it('con sesión, las rutas privadas abren', () => {
    setToken('abc')

    renderAt('/publish')

    expect(screen.getByRole('heading', { level: 1, name: 'Publica tu espacio' })).toBeInTheDocument()
  })

  it('una ruta inexistente muestra el 404 con un enlace al inicio', () => {
    renderAt('/no-existe')

    expect(screen.getByRole('heading', { level: 1, name: 'No encontramos esta página' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/')
  })
})
