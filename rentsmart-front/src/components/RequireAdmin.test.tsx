import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { fakeJwt } from '../test/jwt'
import { setToken } from '../lib/token'
import { RequireAdmin } from './RequireAdmin'

function renderGuarded() {
  const router = createMemoryRouter(
    [
      {
        element: <RequireAdmin />,
        children: [{ path: 'admin', element: <h1>Pantalla de administración</h1> }],
      },
      { path: '/', element: <h1>Catálogo</h1> },
    ],
    { initialEntries: ['/admin'] },
  )
  render(<RouterProvider router={router} />)
}

describe('RequireAdmin', () => {
  it('deja ver la pantalla a un administrador', () => {
    setToken(fakeJwt('ADMIN'))
    renderGuarded()

    expect(screen.getByRole('heading', { name: 'Pantalla de administración' })).toBeInTheDocument()
  })

  it('a un usuario común le avisa que no tiene permiso y le ofrece volver al catálogo', () => {
    setToken(fakeJwt('USER'))
    renderGuarded()

    expect(screen.queryByRole('heading', { name: 'Pantalla de administración' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'No tienes permiso para ver esto' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al catálogo' })).toHaveAttribute('href', '/')
  })

  it('con un token que no dice su rol tampoco deja pasar', () => {
    setToken('dev')
    renderGuarded()

    expect(screen.getByRole('heading', { name: 'No tienes permiso para ver esto' })).toBeInTheDocument()
  })
})
