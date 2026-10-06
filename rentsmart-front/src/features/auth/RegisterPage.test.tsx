import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '../../components/ToastProvider'
import { server } from '../../mocks/server'
import { RegisterPage } from './RegisterPage'
import { validateRegister } from './validation'

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/register', element: <RegisterPage /> },
      { path: '/login', element: <h1>Iniciar sesión</h1> },
    ],
    { initialEntries: ['/register'] },
  )
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )
  return router
}

async function fill(name: string, email: string, password: string) {
  if (name) await userEvent.type(screen.getByLabelText('Nombre'), name)
  if (email) await userEvent.type(screen.getByLabelText('Email'), email)
  if (password) await userEvent.type(screen.getByLabelText('Contraseña'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
}

describe('validateRegister', () => {
  it('acepta datos válidos', () => {
    expect(validateRegister({ name: 'Ana', email: 'ana@mail.com', password: '12345678' })).toEqual({})
  })

  it('exige 8 caracteres: 7 falla y 8 pasa (valores límite)', () => {
    expect(validateRegister({ name: 'Ana', email: 'ana@mail.com', password: '1234567' }).password).toBeDefined()
    expect(validateRegister({ name: 'Ana', email: 'ana@mail.com', password: '12345678' }).password).toBeUndefined()
  })

  it('marca el nombre vacío y el email mal formado', () => {
    const errors = validateRegister({ name: '  ', email: 'no-es-email', password: '12345678' })
    expect(errors.name).toBe('El nombre es obligatorio.')
    expect(errors.email).toBe('Ingresa un email válido.')
  })
})

describe('RegisterPage', () => {
  it('muestra los errores en cada campo sin llamar a la API', async () => {
    renderPage()

    await fill('', 'no-es-email', '123')

    expect(screen.getByLabelText('Nombre')).toHaveAccessibleDescription('El nombre es obligatorio.')
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Ingresa un email válido.')
    expect(screen.getByLabelText('Contraseña')).toHaveAccessibleDescription(
      'La contraseña debe tener al menos 8 caracteres.',
    )
  })

  it('crea la cuenta y lleva al login con el email', async () => {
    let body: unknown
    server.use(
      http.post('*/api/auth/register', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(
          { id: 'u1', email: 'ana@mail.com', name: 'Ana', role: 'USER', isHost: false, createdAt: '2026-10-05T00:00:00Z' },
          { status: 201 },
        )
      }),
    )
    const router = renderPage()

    await fill('Ana', 'Ana@Mail.com', 'Password123')

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(body).toEqual({ name: 'Ana', email: 'Ana@Mail.com', password: 'Password123' })
    expect(router.state.location.state).toEqual({ email: 'ana@mail.com' })
    expect(screen.getByText('Cuenta creada. Ahora inicia sesión.')).toBeInTheDocument()
  })

  it('muestra el 409 de email repetido junto al campo email', async () => {
    server.use(
      http.post('*/api/auth/register', () =>
        HttpResponse.json({ message: 'Ya existe una cuenta con este email.' }, { status: 409 }),
      ),
    )
    renderPage()

    await fill('Ana', 'ana@mail.com', 'Password123')

    expect(await screen.findByText('Ya existe una cuenta con este email.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('muestra un error general si el servidor falla', async () => {
    server.use(http.post('*/api/auth/register', () => HttpResponse.json({}, { status: 500 })))
    renderPage()

    await fill('Ana', 'ana@mail.com', 'Password123')

    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrió un error en el servidor.')
  })
})
