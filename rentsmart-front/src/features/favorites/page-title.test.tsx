import { render, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '../../components/ToastProvider'
import { setToken } from '../../lib/token'
import { routes } from '../../routes'

describe('título de la pestaña: favoritos', () => {
  it('"Mis favoritos" se titula como tal, para que un lector de pantalla lo anuncie al llegar', async () => {
    setToken('abc')
    render(
      <ToastProvider>
        <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/favorites'] })} />
      </ToastProvider>,
    )

    await waitFor(() => expect(document.title).toBe('Mis favoritos · RentSmart'))
  })
})
