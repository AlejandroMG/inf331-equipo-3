import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { getToken, setToken } from '../lib/token'
import { Navbar } from './Navbar'

function renderNavbar(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Navbar />
    </MemoryRouter>,
  )
}

const mainNav = () => screen.getByRole('navigation', { name: 'Principal' })

describe('Navbar', () => {
  it('sin sesión muestra los accesos públicos', () => {
    renderNavbar()

    const nav = mainNav()

    expect(within(nav).getByRole('link', { name: 'Explorar' })).toHaveAttribute('href', '/')
    expect(within(nav).getByRole('link', { name: 'Publicar tu espacio' })).toHaveAttribute('href', '/publish')
    expect(within(nav).getByRole('link', { name: 'Ingresar' })).toHaveAttribute('href', '/login')
    expect(within(nav).getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute('href', '/register')
    expect(within(nav).queryByRole('link', { name: 'Mis espacios' })).toBeNull()
    expect(within(nav).queryByRole('link', { name: 'Administración' })).toBeNull()
  })

  it('marca la página actual', () => {
    setToken('abc')
    renderNavbar('/owner/spaces')

    const nav = mainNav()

    expect(within(nav).getByRole('link', { name: 'Mis espacios' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Explorar' })).not.toHaveAttribute('aria-current')
  })

  it('abre y cierra el menú móvil', async () => {
    renderNavbar()
    const toggle = screen.getByRole('button', { name: 'Abrir menú' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('menu-movil')).toBeNull()

    await userEvent.click(toggle)

    expect(screen.getByRole('button', { name: 'Cerrar menú' })).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('menu-movil')).not.toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar menú' }))

    expect(document.getElementById('menu-movil')).toBeNull()
  })

  it('cierra el menú móvil al elegir un enlace', async () => {
    renderNavbar()
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))

    const menu = document.getElementById('menu-movil')!
    await userEvent.click(within(menu).getByRole('link', { name: 'Ingresar' }))

    expect(document.getElementById('menu-movil')).toBeNull()
  })

  it('con sesión de USER muestra Mis espacios y Salir, pero no Administración', async () => {
    setToken('abc')
    renderNavbar()

    const nav = mainNav()

    expect(within(nav).getByRole('link', { name: 'Mis espacios' })).toHaveAttribute('href', '/owner/spaces')
    expect(within(nav).getByRole('button', { name: 'Salir' })).toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Ingresar' })).toBeNull()
    expect(within(nav).queryByRole('link', { name: 'Crear cuenta' })).toBeNull()
    // Espera a que llegue /auth/me (USER) y confirma que no aparece el menú de admin.
    await screen.findByRole('button', { name: 'Salir' })
    expect(within(nav).queryByRole('link', { name: 'Administración' })).toBeNull()
  })

  it('con sesión de ADMIN muestra Administración', async () => {
    setToken('mock-admin-token')
    renderNavbar()

    expect(await within(mainNav()).findByRole('link', { name: 'Administración' })).toHaveAttribute('href', '/admin')
  })

  it('Salir cierra la sesión y vuelve a mostrar Ingresar', async () => {
    setToken('abc')
    renderNavbar('/owner/spaces')

    const nav = mainNav()
    await userEvent.click(within(nav).getByRole('button', { name: 'Salir' }))

    expect(getToken()).toBeNull()
    expect(within(nav).getByRole('link', { name: 'Ingresar' })).toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Mis espacios' })).toBeNull()
  })
})
