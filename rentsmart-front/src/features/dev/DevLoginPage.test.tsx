import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { getToken } from '../../lib/token'
import { DevLoginPage } from './DevLoginPage'

function renderLogin(state?: { from: string }) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <DevLoginPage /> },
      { path: '/', element: <p>Inicio</p> },
      { path: '/publish', element: <p>Publicar</p> },
    ],
    { initialEntries: [{ pathname: '/login', state }] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('DevLoginPage', () => {
  it('guarda un token de desarrollo y vuelve a la ruta que se pedía', async () => {
    const router = renderLogin({ from: '/publish' })
    expect(getToken()).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Entrar como propietario de prueba' }))

    expect(getToken()).toBe('dev')
    expect(router.state.location.pathname).toBe('/publish')
  })

  it('sin ruta de origen va al inicio', async () => {
    const router = renderLogin()

    await userEvent.click(screen.getByRole('button', { name: 'Entrar como propietario de prueba' }))

    expect(router.state.location.pathname).toBe('/')
  })
})
