import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '../../components/ToastProvider'
import { setToken } from '../../lib/token'
import { routes } from '../../routes'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )
  return router
}

describe('administración: rutas y título de la pestaña', () => {
  it.each([
    ['/admin/spaces', 'Administración de espacios · RentSmart'],
    ['/admin/space-types', 'Tipos de espacio · RentSmart'],
  ])('%s se titula "%s"', async (path, title) => {
    setToken('mock-admin-token')
    renderAt(path)

    await waitFor(() => expect(document.title).toBe(title))
  })

  it('"Administración" (/admin) lleva a la moderación de espacios mientras no exista el panel', async () => {
    setToken('mock-admin-token')
    const router = renderAt('/admin')

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/spaces'))
  })

  it('un usuario común no ve la moderación, sino el aviso de falta de permiso', async () => {
    setToken('abc')
    renderAt('/admin/spaces')

    expect(await screen.findByRole('heading', { name: 'No tienes acceso a esta página' })).toBeInTheDocument()
  })

  it('sin sesión redirige a iniciar sesión', async () => {
    const router = renderAt('/admin/space-types')

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })
})
