import { render, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '../../components/ToastProvider'
import { setToken } from '../../lib/token'
import { routes } from '../../routes'
import { fakeJwt } from '../../test/jwt'

function renderAt(path: string) {
  render(
    <ToastProvider>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
    </ToastProvider>,
  )
}

describe('título de la pestaña: administración', () => {
  it.each([
    ['/admin/spaces', 'Administración de espacios · RentSmart'],
    ['/admin/space-types', 'Tipos de espacio · RentSmart'],
  ])('%s se titula "%s"', async (path, title) => {
    setToken(fakeJwt('ADMIN'))
    renderAt(path)

    await waitFor(() => expect(document.title).toBe(title))
  })

  it('un usuario común, que no tiene permiso, ve su propio título', async () => {
    setToken(fakeJwt('USER'))
    renderAt('/admin/spaces')

    await waitFor(() => expect(document.title).toBe('Sin permiso · RentSmart'))
  })
})
