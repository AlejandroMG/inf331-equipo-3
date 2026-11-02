import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { ToastProvider } from '../../components/ToastProvider'
import { clearToken, setToken } from '../../lib/token'
import { server } from '../../mocks/server'
import { ProfilePage } from './ProfilePage'

function renderProfile() {
  const router = createMemoryRouter(
    [{ path: '/profile', element: <ProfilePage /> }],
    { initialEntries: ['/profile'] },
  )
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )
}

afterEach(() => clearToken())

describe('ProfilePage', () => {
  it('permite activar el modo propietario desde el perfil', async () => {
    setToken('mock-token')
    renderProfile()

    expect(await screen.findByText('Usuario de prueba')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Habilitarme como propietario' }))

    expect(await screen.findByText('Tu cuenta está habilitada para publicar espacios.')).toBeInTheDocument()
    expect(screen.getByText('Ya puedes publicar espacios como propietario.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Habilitarme como propietario' })).not.toBeInTheDocument()
  })

  it('muestra el error del servidor y permite intentarlo otra vez', async () => {
    let attempts = 0
    server.use(
      http.post('*/api/auth/host', () => {
        attempts += 1
        if (attempts === 1) {
          return HttpResponse.json({ message: 'Error temporal.' }, { status: 500 })
        }
        return HttpResponse.json({
          id: 'mock-user',
          email: 'usuario@rentsmart.test',
          name: 'Usuario de prueba',
          role: 'USER',
          isHost: true,
          createdAt: '2026-10-01T00:00:00.000Z',
        })
      }),
    )
    setToken('mock-token')
    renderProfile()
    await screen.findByText('Usuario de prueba')

    await userEvent.click(screen.getByRole('button', { name: 'Habilitarme como propietario' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Error temporal.')
    expect(screen.getByRole('button', { name: 'Habilitarme como propietario' })).toBeEnabled()
  })
})
