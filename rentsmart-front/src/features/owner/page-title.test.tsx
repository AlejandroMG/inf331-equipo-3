import { render, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '../../components/ToastProvider'
import { setToken } from '../../lib/token'
import { routes } from '../../routes'

describe('título de la pestaña: panel del propietario', () => {
  it.each([
    ['/owner/bookings', 'Reservas de mis espacios · RentSmart'],
    ['/owner/metrics', 'Métricas · RentSmart'],
  ])('%s se titula "%s"', async (path, title) => {
    setToken('abc')
    render(
      <ToastProvider>
        <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
      </ToastProvider>,
    )

    await waitFor(() => expect(document.title).toBe(title))
  })
})
