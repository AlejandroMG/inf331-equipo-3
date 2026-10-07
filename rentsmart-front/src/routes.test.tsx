import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

    expect(screen.getByRole('heading', { level: 1, name: 'Encuentra el espacio justo, por hora o por día' })).toBeInTheDocument()
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

  it('con sesión, las rutas privadas abren', async () => {
    setToken('abc')

    renderAt('/publish')

    expect(await screen.findByRole('heading', { level: 1, name: 'Publica tu espacio' })).toBeInTheDocument()
  })

  it('una ruta inexistente muestra el 404 con un enlace al inicio', () => {
    renderAt('/no-existe')

    expect(screen.getByRole('heading', { level: 1, name: 'No encontramos esta página' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/')
  })
})

describe('título de la pestaña', () => {
  it.each([
    ['/', 'Espacios para arrendar · RentSmart'],
    ['/login', 'Iniciar sesión · RentSmart'],
    ['/register', 'Crear cuenta · RentSmart'],
    ['/ruta-inexistente', 'Página no encontrada · RentSmart'],
  ])('%s se titula "%s"', async (path, title) => {
    renderAt(path)

    await waitFor(() => expect(document.title).toBe(title))
  })

  it('el detalle se titula con el nombre del espacio', async () => {
    renderAt('/spaces/seed-space-1')

    await waitFor(() => expect(document.title).toBe('Sala Alameda · RentSmart'))
  })

  it('un espacio que no existe tiene su propio título', async () => {
    renderAt('/spaces/no-existe')

    await waitFor(() => expect(document.title).toBe('Espacio no disponible · RentSmart'))
  })

  it.each([
    ['/owner/spaces', 'Mis espacios · RentSmart'],
    ['/publish', 'Publica tu espacio · RentSmart'],
  ])('con sesión, %s se titula "%s"', async (path, title) => {
    setToken('abc')
    renderAt(path)

    await waitFor(() => expect(document.title).toBe(title))
  })

  it('al cambiar de pantalla cambia el título', async () => {
    renderAt('/login')
    await waitFor(() => expect(document.title).toBe('Iniciar sesión · RentSmart'))

    await userEvent.click(screen.getByRole('link', { name: 'RentSmart, ir al inicio' }))

    await waitFor(() => expect(document.title).toBe('Espacios para arrendar · RentSmart'))
  })
})

describe('foco al navegar', () => {
  it('al abrir la app no se le quita el foco a nadie', () => {
    renderAt('/')

    expect(document.body).toHaveFocus()
  })

  it('al pasar a otra pantalla el foco va al contenido', async () => {
    renderAt('/')
    await userEvent.click(await screen.findByRole('link', { name: /Sala Alameda/ }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Sala Alameda' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('cambiar un filtro no es cambiar de pantalla: el foco se queda donde está', async () => {
    renderAt('/')
    const chip = await screen.findByRole('button', { name: 'Taller' })

    await userEvent.click(chip)

    expect(await screen.findByText('2 espacios')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Taller', pressed: true })).toHaveFocus()
    expect(screen.getByRole('main')).not.toHaveFocus()
  })

  it('el contenido se puede enfocar por programa, pero no entra en el orden de tabulación', () => {
    renderAt('/')

    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1')
  })
})
