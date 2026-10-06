import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { ToastProvider } from '../../components/ToastProvider'
import { clearToken, getToken } from '../../lib/token'
import { server } from '../../mocks/server'
import { LoginPage } from './LoginPage'
import { validateLogin } from './validation'

const USER = {
  id: 'u1',
  email: 'ana@mail.com',
  name: 'Ana',
  role: 'USER',
  isHost: false,
  createdAt: '2026-10-05T00:00:00Z',
}

function renderLogin(state?: object) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/', element: <h1>Inicio</h1> },
      { path: '/publish', element: <h1>Publica tu espacio</h1> },
    ],
    { initialEntries: [{ pathname: '/login', state }] },
  )
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )
  return router
}

async function submit(email: string, password: string) {
  if (email) await userEvent.type(screen.getByLabelText('Email'), email)
  if (password) await userEvent.type(screen.getByLabelText('Contraseña'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
}

afterEach(() => clearToken())

describe('validateLogin', () => {
  it('exige un email válido y la contraseña', () => {
    expect(validateLogin({ email: 'no-es-email', password: '' })).toEqual({
      email: 'Ingresa un email válido.',
      password: 'Ingresa tu contraseña.',
    })
    expect(validateLogin({ email: 'ana@mail.com', password: 'x' })).toEqual({})
  })
})

describe('LoginPage', () => {
  it('muestra los errores sin llamar a la API', async () => {
    renderLogin()

    await submit('', '')

    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Ingresa un email válido.')
    expect(screen.getByLabelText('Contraseña')).toHaveAccessibleDescription('Ingresa tu contraseña.')
  })

  it('precarga el email que viene del registro', () => {
    renderLogin({ email: 'ana@mail.com' })

    expect(screen.getByLabelText('Email')).toHaveValue('ana@mail.com')
  })

  it('guarda el token y vuelve a la ruta privada que se pidió', async () => {
    server.use(http.post('*/api/auth/login', () => HttpResponse.json({ accessToken: 'jwt-123', user: USER })))
    const router = renderLogin({ from: '/publish' })

    await submit('ana@mail.com', 'Password123')

    expect(await screen.findByRole('heading', { name: 'Publica tu espacio' })).toBeInTheDocument()
    expect(getToken()).toBe('jwt-123')
    expect(router.state.location.pathname).toBe('/publish')
    expect(screen.getByText('Hola, Ana.')).toBeInTheDocument()
  })

  it('sin ruta pedida, lleva al inicio', async () => {
    server.use(http.post('*/api/auth/login', () => HttpResponse.json({ accessToken: 'jwt-123', user: USER })))
    renderLogin()

    await submit('ana@mail.com', 'Password123')

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
  })

  it.each([
    [401, 'Email o contraseña incorrectos.'],
    [403, 'Tu cuenta está suspendida. Escríbenos si crees que es un error.'],
  ])('muestra el mensaje de la API ante un %i y no guarda token', async (status, message) => {
    server.use(http.post('*/api/auth/login', () => HttpResponse.json({ message }, { status })))
    renderLogin()

    await submit('ana@mail.com', 'Password123')

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(getToken()).toBeNull()
  })

  it('enlaza al registro', () => {
    renderLogin()

    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute('href', '/register')
  })
})
