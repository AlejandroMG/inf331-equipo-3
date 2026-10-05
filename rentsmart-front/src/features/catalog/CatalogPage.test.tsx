import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http as mswHttp, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { server } from '../../mocks/server'
import { CatalogPage } from './CatalogPage'

function renderCatalog(path = '/') {
  const router = createMemoryRouter([{ path: '/', element: <CatalogPage /> }], { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('CatalogPage', () => {
  it('muestra un estado de carga y luego los espacios con su total', async () => {
    renderCatalog()

    expect(screen.getByRole('status', { name: 'Cargando espacios' })).toBeInTheDocument()

    expect(await screen.findByRole('heading', { level: 3, name: 'Sala Alameda' })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Cargando espacios' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(12)
    expect(screen.getByText('14 espacios')).toBeInTheDocument()
  })

  it('pagina: la página 2 muestra el resto y la URL lleva ?page', async () => {
    const router = renderCatalog()
    await screen.findByRole('heading', { level: 3, name: 'Sala Alameda' })

    await userEvent.click(screen.getByRole('link', { name: 'Página 2' }))

    expect(await screen.findByRole('heading', { level: 3, name: 'Taller de cerámica' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2)
    expect(screen.queryByRole('heading', { level: 3, name: 'Sala Alameda' })).not.toBeInTheDocument()
    expect(router.state.location.search).toBe('?page=2')
  })

  it('abre directo en la página de la URL', async () => {
    renderCatalog('/?page=2')

    expect(await screen.findByRole('heading', { level: 3, name: 'Taller de cerámica' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
  })

  it.each(['/?page=abc', '/?page=0', '/?page=-3', '/?page=1.5'])('con %s vuelve a la página 1', async (path) => {
    renderCatalog(path)

    expect(await screen.findByRole('heading', { level: 3, name: 'Sala Alameda' })).toBeInTheDocument()
  })

  it('cada tarjeta enlaza al detalle del espacio', async () => {
    renderCatalog()

    const card = (await screen.findByRole('heading', { level: 3, name: 'Sala Alameda' })).closest('a')!

    expect(within(card).getByText('Santiago')).toBeInTheDocument()
    expect(card).toHaveAttribute('href', '/spaces/seed-space-1')
  })

  it('con un error muestra el mensaje y permite reintentar', async () => {
    let calls = 0
    server.use(
      mswHttp.get('*/api/catalog', () => {
        calls += 1
        return calls === 1
          ? HttpResponse.json({ message: 'Servicio caído' }, { status: 500 })
          : HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 12 })
      }),
    )
    renderCatalog()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No pudimos cargar los espacios.')
    expect(alert).toHaveTextContent('Servicio caído')

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Todavía no hay espacios publicados')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('sin espacios muestra un mensaje y no la paginación', async () => {
    server.use(mswHttp.get('*/api/catalog', () => HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 12 })))
    renderCatalog()

    expect(await screen.findByText('Todavía no hay espacios publicados')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument()
  })
})
