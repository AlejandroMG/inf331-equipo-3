import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http as mswHttp, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '../../components/ToastProvider'
import { clearToken, setToken } from '../../lib/token'
import { server } from '../../mocks/server'
import { CatalogPage } from '../catalog/CatalogPage'
import { SpaceDetailPage } from '../catalog/SpaceDetailPage'
import { FavoritesPage } from './FavoritesPage'
import { FavoritesProvider } from './FavoritesProvider'

const routes = [
  { path: '/', element: <CatalogPage /> },
  { path: '/spaces/:spaceId', element: <SpaceDetailPage /> },
  { path: '/favorites', element: <FavoritesPage /> },
  { path: '/login', element: <p>Pantalla de inicio de sesión</p> },
]

function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <ToastProvider>
      <FavoritesProvider>
        <RouterProvider router={router} />
      </FavoritesProvider>
    </ToastProvider>,
  )
  return router
}

const heart = (name: string) => screen.findByRole('button', { name: `Guardar en favoritos: ${name}` })

/** Cuenta las peticiones de favoritos que salen, para comprobar qué se pide y qué no. */
function spyOnFavorites() {
  const calls: string[] = []
  server.events.on('request:start', ({ request }) => {
    const { pathname } = new URL(request.url)
    if (pathname.startsWith('/api/favorites')) calls.push(`${request.method} ${pathname}`)
  })
  return calls
}

describe('corazón de favoritos (BU-08)', () => {
  describe('con sesión', () => {
    it('marca y desmarca un espacio, y se ve al instante', async () => {
      setToken('abc')
      const calls = spyOnFavorites()
      renderApp()
      const button = await heart('Sala Alameda')
      expect(button).toHaveAttribute('aria-pressed', 'false')

      await userEvent.click(button)
      expect(button).toHaveAttribute('aria-pressed', 'true')
      await waitFor(() => expect(calls).toContain('PUT /api/favorites/seed-space-1'))

      await userEvent.click(button)
      expect(button).toHaveAttribute('aria-pressed', 'false')
      await waitFor(() => expect(calls).toContain('DELETE /api/favorites/seed-space-1'))
    })

    it('al abrir marca los espacios que ya eran favoritos', async () => {
      setToken('abc')
      server.use(mswHttp.get('*/api/favorites/ids', () => HttpResponse.json(['seed-space-2'])))
      renderApp()

      await waitFor(async () => expect(await heart('Estudio Luz Norte')).toHaveAttribute('aria-pressed', 'true'))
      expect(await heart('Sala Alameda')).toHaveAttribute('aria-pressed', 'false')
    })

    it('si el servidor lo rechaza, deshace el cambio y avisa', async () => {
      setToken('abc')
      server.use(mswHttp.put('*/api/favorites/:spaceId', () => HttpResponse.json({ message: 'Llegaste al máximo de 200 favoritos' }, { status: 409 })))
      renderApp()
      const button = await heart('Sala Alameda')

      await userEvent.click(button)

      expect(await screen.findByText('Llegaste al máximo de 200 favoritos')).toBeInTheDocument()
      expect(button).toHaveAttribute('aria-pressed', 'false')
    })

    it('si falla al quitarlo, lo deja marcado y avisa', async () => {
      setToken('abc')
      server.use(
        mswHttp.get('*/api/favorites/ids', () => HttpResponse.json(['seed-space-1'])),
        mswHttp.delete('*/api/favorites/:spaceId', () => HttpResponse.json({}, { status: 500 })),
      )
      renderApp()
      const button = await heart('Sala Alameda')
      await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'))

      await userEvent.click(button)

      expect(await screen.findByRole('alert')).toBeInTheDocument()
      await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'))
    })

    it('si no cargan los favoritos de la sesión, el catálogo funciona y se puede guardar', async () => {
      setToken('abc')
      server.use(mswHttp.get('*/api/favorites/ids', () => HttpResponse.json({}, { status: 500 })))
      renderApp()
      const button = await heart('Sala Alameda')

      await userEvent.click(button)

      expect(button).toHaveAttribute('aria-pressed', 'true')
    })

    it('al cerrar la sesión los corazones se vacían', async () => {
      setToken('abc')
      server.use(mswHttp.get('*/api/favorites/ids', () => HttpResponse.json(['seed-space-1'])))
      renderApp()
      const button = await heart('Sala Alameda')
      await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'))

      clearToken()

      await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'))
    })

    it('dos clics seguidos no mandan dos peticiones mientras la primera sigue en curso', async () => {
      setToken('abc')
      const calls = spyOnFavorites()
      renderApp()
      const button = await heart('Sala Alameda')

      await userEvent.dblClick(button)

      await waitFor(() => expect(calls.filter((c) => c.startsWith('PUT') || c.startsWith('DELETE')).length).toBeLessThanOrEqual(2))
      expect(calls.filter((c) => c.startsWith('PUT'))).toHaveLength(1)
    })

    it('el detalle tiene su propio botón, que comparte el estado con el de la tarjeta', async () => {
      setToken('abc')
      server.use(mswHttp.get('*/api/favorites/ids', () => HttpResponse.json(['seed-space-1'])))
      renderApp('/spaces/seed-space-1')

      const button = await screen.findByRole('button', { name: 'Guardar en favoritos' })

      await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'))
      await userEvent.click(button)
      expect(button).toHaveAttribute('aria-pressed', 'false')
    })
  })

  describe('sin sesión', () => {
    it('no pide los favoritos al servidor', async () => {
      const calls = spyOnFavorites()
      renderApp()
      await heart('Sala Alameda')

      expect(calls).toEqual([])
    })

    it('el corazón lleva a iniciar sesión y recuerda a dónde volver', async () => {
      const router = renderApp('/?q=sala')
      const button = await heart('Sala Alameda')

      await userEvent.click(button)

      expect(await screen.findByText('Pantalla de inicio de sesión')).toBeInTheDocument()
      expect(router.state.location.state).toEqual({ from: '/?q=sala' })
    })
  })
})

describe('FavoritesPage', () => {
  it('sin favoritos lo dice y lleva a explorar', async () => {
    setToken('abc')
    renderApp('/favorites')

    expect(await screen.findByRole('heading', { level: 2, name: 'Todavía no tienes favoritos' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Explorar espacios' })).toHaveAttribute('href', '/')
  })

  it('muestra los favoritos como tarjetas, el último guardado primero, con su total', async () => {
    setToken('abc')
    server.use(
      mswHttp.get('*/api/favorites', () =>
        HttpResponse.json({
          items: [
            { id: 'seed-space-2', name: 'Estudio Luz Norte', typeName: 'Estudio', communeName: 'Providencia', capacity: 8, pricePerHour: 18000, pricePerDay: null, coverUrl: null },
            { id: 'seed-space-1', name: 'Sala Alameda', typeName: 'Sala', communeName: 'Santiago', capacity: 10, pricePerHour: 12000, pricePerDay: null, coverUrl: null },
          ],
          total: 2,
          page: 1,
          pageSize: 12,
        }),
      ),
      mswHttp.get('*/api/favorites/ids', () => HttpResponse.json(['seed-space-2', 'seed-space-1'])),
    )
    renderApp('/favorites')

    const cards = await screen.findAllByRole('heading', { level: 3 })
    expect(cards.map((c) => c.textContent)).toEqual(['Estudio Luz Norte', 'Sala Alameda'])
    expect(screen.getByText('2 espacios guardados')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Mis favoritos' })).toBeInTheDocument()
  })

  it('desmarcar un corazón saca la tarjeta de la lista al instante', async () => {
    setToken('abc')
    const item = (id: string, name: string) => ({ id, name, typeName: 'Sala', communeName: 'Santiago', capacity: 4, pricePerHour: 5000, pricePerDay: null, coverUrl: null })
    server.use(
      mswHttp.get('*/api/favorites', () =>
        HttpResponse.json({ items: [item('seed-space-2', 'Estudio Luz Norte'), item('seed-space-1', 'Sala Alameda')], total: 2, page: 1, pageSize: 12 }),
      ),
      mswHttp.get('*/api/favorites/ids', () => HttpResponse.json(['seed-space-2', 'seed-space-1'])),
    )
    renderApp('/favorites')
    expect(await screen.findAllByRole('heading', { level: 3 })).toHaveLength(2)

    await userEvent.click(await heart('Estudio Luz Norte'))

    await waitFor(() => expect(screen.queryByRole('heading', { level: 3, name: 'Estudio Luz Norte' })).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { level: 3, name: 'Sala Alameda' })).toBeInTheDocument()
  })

  it('al quitar todos los de la página, lo dice y ofrece volver a la lista', async () => {
    setToken('abc')
    server.use(
      mswHttp.get('*/api/favorites', () =>
        HttpResponse.json({
          items: [{ id: 'seed-space-1', name: 'Sala Alameda', typeName: 'Sala', communeName: 'Santiago', capacity: 4, pricePerHour: 5000, pricePerDay: null, coverUrl: null }],
          total: 1,
          page: 1,
          pageSize: 12,
        }),
      ),
      mswHttp.get('*/api/favorites/ids', () => HttpResponse.json(['seed-space-1'])),
    )
    renderApp('/favorites')

    await userEvent.click(await heart('Sala Alameda'))

    expect(await screen.findByRole('heading', { level: 2, name: 'Quitaste los favoritos de esta página' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver mis favoritos' })).toHaveAttribute('href', '/favorites')
  })

  it('pagina, y los enlaces llevan a la página pedida', async () => {
    setToken('abc')
    server.use(
      mswHttp.get('*/api/favorites', ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page'))
        return HttpResponse.json({
          items: [{ id: `s${page}`, name: `Espacio ${page}`, typeName: 'Sala', communeName: 'Santiago', capacity: 4, pricePerHour: 5000, pricePerDay: null, coverUrl: null }],
          total: 30,
          page,
          pageSize: 12,
        })
      }),
      mswHttp.get('*/api/favorites/ids', () => HttpResponse.json(['s2'])),
    )
    renderApp('/favorites?page=2')

    expect(await screen.findByRole('heading', { level: 3, name: 'Espacio 2' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Página 3' })).toHaveAttribute('href', '/favorites?page=3')
  })

  it.each(['?page=abc', '?page=0', '?page=-2'])('con %s abre la primera página', async (query) => {
    setToken('abc')
    renderApp(`/favorites${query}`)

    expect(await screen.findByRole('heading', { level: 2, name: 'Todavía no tienes favoritos' })).toBeInTheDocument()
  })

  it('si no carga, muestra el error y deja reintentar', async () => {
    setToken('abc')
    let fails = true
    server.use(
      mswHttp.get('*/api/favorites', () =>
        fails
          ? HttpResponse.json({ message: 'Falló el servidor' }, { status: 500 })
          : HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 12 }),
      ),
    )
    renderApp('/favorites')

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tus favoritos.')
    fails = false
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('heading', { level: 2, name: 'Todavía no tienes favoritos' })).toBeInTheDocument()
  })
})
