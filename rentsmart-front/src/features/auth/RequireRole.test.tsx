import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { setToken } from '../../lib/token'
import { RequireRole } from './RequireRole'

function renderAdmin() {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <h1>Iniciar sesión</h1> },
      { element: <RequireRole role="ADMIN" />, children: [{ path: '/admin', element: <h1>Panel admin</h1> }] },
    ],
    { initialEntries: ['/admin'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('RequireRole', () => {
  it('sin sesión redirige a /login y recuerda la ruta', async () => {
    const router = renderAdmin()

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(router.state.location.state).toEqual({ from: '/admin' })
  })

  it('con el rol correcto muestra la pantalla', async () => {
    setToken('mock-admin-token')
    renderAdmin()

    expect(await screen.findByRole('heading', { name: 'Panel admin' })).toBeInTheDocument()
  })

  it('con otro rol muestra el aviso de acceso denegado', async () => {
    setToken('token-de-usuario')
    renderAdmin()

    expect(await screen.findByRole('heading', { name: 'No tienes acceso a esta página' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Panel admin' })).toBeNull()
  })
})
