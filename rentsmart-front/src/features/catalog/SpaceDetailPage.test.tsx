import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http as mswHttp, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { server } from '../../mocks/server'
import { CatalogPage } from './CatalogPage'
import { SpaceDetailPage } from './SpaceDetailPage'
import type { SpaceDetail } from './types'

const detail: SpaceDetail = {
  id: 'abc',
  name: 'Sala Alameda',
  description: 'Sala luminosa en pleno centro.',
  typeName: 'Sala de reuniones',
  regionName: 'Región Metropolitana',
  communeName: 'Santiago',
  address: 'Av. Libertador 1234',
  location: { latitude: -33.449, longitude: -70.669, radiusMeters: 150 },
  capacity: 10,
  pricePerHour: 12000,
  pricePerDay: 90000,
  rules: 'No fumar.',
  amenities: ['Aire acondicionado', 'Wifi'],
  photos: [
    { id: 'p1', url: 'https://fotos.test/1.jpg', position: 0 },
    { id: 'p2', url: 'https://fotos.test/2.jpg', position: 1 },
  ],
  schedule: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: '09:00', endTime: '21:00' })),
}

function serve(space: Partial<SpaceDetail> = {}) {
  server.use(mswHttp.get('*/api/catalog/abc', () => HttpResponse.json({ ...detail, ...space })))
}

function renderDetail(id = 'abc') {
  const router = createMemoryRouter(
    [
      { path: '/', element: <CatalogPage /> },
      { path: '/spaces/:spaceId', element: <SpaceDetailPage /> },
    ],
    { initialEntries: [`/spaces/${id}`] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('SpaceDetailPage', () => {
  it('muestra el estado de carga y luego el espacio', async () => {
    serve()
    renderDetail()

    expect(screen.getByRole('status', { name: 'Cargando el espacio' })).toBeInTheDocument()

    expect(await screen.findByRole('heading', { level: 1, name: 'Sala Alameda' })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Cargando el espacio' })).not.toBeInTheDocument()
  })

  it('muestra los datos del espacio', async () => {
    serve()
    renderDetail()
    await screen.findByRole('heading', { level: 1, name: 'Sala Alameda' })

    expect(screen.getByText('Sala luminosa en pleno centro.')).toBeInTheDocument()
    expect(screen.getByText('Hasta 10 personas')).toBeInTheDocument()
    expect(screen.getByText('No fumar.')).toBeInTheDocument()
    expect(screen.getByText('Av. Libertador 1234, Santiago, Región Metropolitana')).toBeInTheDocument()
    const amenities = screen.getByRole('heading', { name: 'Qué incluye' }).closest('section')!
    expect(within(amenities).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Aire acondicionado', 'Wifi'])
  })

  it('muestra los precios por hora y por día en la caja de reserva', async () => {
    serve()
    renderDetail()
    await screen.findByRole('heading', { level: 1, name: 'Sala Alameda' })

    const aside = screen.getByRole('complementary', { name: 'Reservar' })

    expect(aside).toHaveTextContent('$12.000')
    expect(aside).toHaveTextContent('/ hora')
    expect(aside).toHaveTextContent('o $90.000 / día')
    expect(aside).toHaveTextContent('La reserva en línea estará disponible muy pronto.')
  })

  it('con solo precio por día lo muestra como precio principal', async () => {
    serve({ pricePerHour: null })
    renderDetail()
    await screen.findByRole('heading', { level: 1, name: 'Sala Alameda' })

    const aside = screen.getByRole('complementary', { name: 'Reservar' })

    expect(aside).toHaveTextContent('$90.000')
    expect(aside).not.toHaveTextContent('/ hora')
  })

  it('agrupa el horario por días', async () => {
    serve()
    renderDetail()
    await screen.findByRole('heading', { level: 1, name: 'Sala Alameda' })

    const table = screen.getByRole('table', { name: 'Horario semanal' })

    expect(within(table).getByRole('row', { name: /Lunes a viernes 09:00 – 21:00/ })).toBeInTheDocument()
    expect(within(table).getByRole('row', { name: /Sábado y domingo No disponible/ })).toBeInTheDocument()
  })

  it('avisa que el detalle de la dirección es privado y que aún no hay reseñas', async () => {
    serve()
    renderDetail()
    await screen.findByRole('heading', { level: 1, name: 'Sala Alameda' })

    expect(screen.getByText(/se muestra cuando tu reserva esté confirmada/)).toBeInTheDocument()
    expect(screen.getByText(/aún no tiene reseñas/)).toBeInTheDocument()
  })

  describe('mapa', () => {
    it('muestra la zona aproximada en un mapa cuando el propietario marcó el punto', async () => {
      serve()
      renderDetail()

      const map = await screen.findByRole('region', { name: 'Mapa con la ubicación aproximada de Sala Alameda' })

      expect(await within(map).findByRole('button', { name: 'Acercar' })).toBeInTheDocument()
      expect(within(map).getByRole('button', { name: 'Alejar' })).toBeInTheDocument()
      expect(screen.getByText('El círculo marca la zona aproximada del espacio.')).toBeInTheDocument()
    })

    it('sin punto marcado no hay mapa, y la dirección escrita sigue ahí', async () => {
      serve({ location: null })
      renderDetail()
      await screen.findByRole('heading', { level: 1, name: 'Sala Alameda' })

      expect(screen.queryByRole('region', { name: /Mapa con la ubicación/ })).not.toBeInTheDocument()
      expect(screen.getByText('Av. Libertador 1234, Santiago, Región Metropolitana')).toBeInTheDocument()
    })
  })

  it('muestra la galería con las fotos del espacio', async () => {
    serve()
    renderDetail()

    expect(await screen.findByRole('img', { name: 'Sala Alameda, foto 1 de 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver foto 2' })).toBeInTheDocument()
  })

  it('omite las secciones que el espacio no tiene', async () => {
    serve({ description: null, amenities: [], rules: null, schedule: [], photos: [] })
    renderDetail()
    await screen.findByRole('heading', { level: 1, name: 'Sala Alameda' })

    for (const title of ['Sobre este espacio', 'Qué incluye', 'Reglas del espacio', 'Horario de atención']) {
      expect(screen.queryByRole('heading', { name: title })).not.toBeInTheDocument()
    }
    expect(screen.getByRole('heading', { name: 'Ubicación' })).toBeInTheDocument()
  })

  it('el enlace "Catálogo" vuelve a la lista', async () => {
    serve()
    const router = renderDetail()
    await screen.findByRole('heading', { level: 1, name: 'Sala Alameda' })

    await userEvent.click(screen.getByRole('link', { name: 'Catálogo' }))

    expect(router.state.location.pathname).toBe('/')
  })

  it('un espacio que no existe o no está activo muestra un aviso con enlace al catálogo', async () => {
    renderDetail('no-existe')

    expect(await screen.findByRole('heading', { level: 1, name: 'Este espacio no está disponible' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver el catálogo' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('con otro error muestra el mensaje y permite reintentar', async () => {
    let calls = 0
    server.use(
      mswHttp.get('*/api/catalog/abc', () => {
        calls += 1
        return calls === 1 ? HttpResponse.json({ message: 'Servicio caído' }, { status: 500 }) : HttpResponse.json(detail)
      }),
    )
    renderDetail()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No pudimos cargar el espacio.')
    expect(alert).toHaveTextContent('Servicio caído')

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Sala Alameda' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('codifica el id en la petición', async () => {
    let requested = ''
    server.use(
      mswHttp.get('*/api/catalog/:id', ({ request }) => {
        requested = new URL(request.url).pathname
        return HttpResponse.json({ ...detail, id: 'a/b' })
      }),
    )
    renderDetail('a%2Fb')

    await screen.findByRole('heading', { level: 1, name: 'Sala Alameda' })

    expect(requested).toBe('/api/catalog/a%2Fb')
  })
})
