import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http as mswHttp, HttpResponse } from 'msw'
import { act } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { server } from '../../mocks/server'
import { PublishSpacePage } from './PublishSpacePage'

function renderPublish(path = '/publish') {
  const router = createMemoryRouter([{ path: 'publish/:spaceId?', element: <PublishSpacePage /> }], { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

/** Cuenta y guarda los cuerpos de POST y PATCH que recibe la API simulada, sin cambiar su respuesta. */
function spyOnSaves() {
  const calls: Array<{ method: string; url: string; body: Record<string, unknown> }> = []
  server.events.on('request:start', async ({ request }) => {
    if (['POST', 'PATCH'].includes(request.method) && new URL(request.url).pathname.startsWith('/api/spaces')) {
      calls.push({ method: request.method, url: new URL(request.url).pathname, body: await request.clone().json() })
    }
  })
  return calls
}

async function openForm(path?: string) {
  const router = renderPublish(path)
  await screen.findByRole('heading', { level: 1, name: 'Publica tu espacio' })
  return router
}

const next = () => userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

describe('PublishSpacePage', () => {
  it('muestra el paso 1 con los tipos y el equipamiento que trae la API', async () => {
    await openForm()

    expect(screen.getByText('Paso 1 de 5 · Información')).toBeInTheDocument()
    expect(within(screen.getByLabelText('Tipo de espacio')).getAllByRole('option')).toHaveLength(9) // marcador + 8 tipos
    expect(screen.getByRole('button', { name: 'Wifi' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Tu avance se guarda como borrador en cada paso.')).toBeInTheDocument()
  })

  it('muestra un estado de carga mientras llegan los datos', () => {
    renderPublish()

    expect(screen.getByRole('status', { name: 'Cargando el formulario' })).toBeInTheDocument()
  })

  it('sin nombre no guarda ni avanza y pide ponerle uno', async () => {
    const saves = spyOnSaves()
    await openForm()

    await next()

    expect(await screen.findByText('Ponle un nombre a tu espacio.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre del espacio')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Paso 1 de 5 · Información')).toBeInTheDocument()
    expect(saves).toEqual([])
  })

  it('al avanzar crea el borrador, pasa al paso 2 y deja el borrador en la URL', async () => {
    const saves = spyOnSaves()
    const router = await openForm()
    await userEvent.type(screen.getByLabelText('Nombre del espacio'), 'Sala Alameda')
    await userEvent.selectOptions(screen.getByLabelText('Tipo de espacio'), 'Sala de reuniones')
    await userEvent.type(screen.getByLabelText('Capacidad (personas)'), '10')
    await userEvent.click(screen.getByRole('button', { name: 'Wifi' }))

    await next()

    expect(await screen.findByText('Paso 2 de 5 · Ubicación')).toBeInTheDocument()
    expect(screen.getByText('Borrador guardado')).toBeInTheDocument()
    expect(saves).toHaveLength(1)
    expect(saves[0]).toMatchObject({
      method: 'POST',
      url: '/api/spaces',
      body: { name: 'Sala Alameda', typeId: 1, capacity: 10, regionId: 1, amenityIds: [1], description: null },
    })
    expect(router.state.location.pathname).toBe('/publish/draft-1')
  })

  it('los pasos siguientes actualizan el mismo borrador y conservan lo escrito', async () => {
    const saves = spyOnSaves()
    await openForm()
    await userEvent.type(screen.getByLabelText('Nombre del espacio'), 'Sala Alameda')
    await next()
    await screen.findByText('Paso 2 de 5 · Ubicación')

    await userEvent.selectOptions(screen.getByLabelText('Comuna'), 'Providencia')
    await userEvent.type(screen.getByLabelText('Dirección pública'), 'Av. Libertador 1234')
    await userEvent.type(screen.getByLabelText('Detalle de la dirección (privado)'), 'Oficina 301')
    await next()

    expect(await screen.findByText('Paso 3 de 5 · Precio y horario')).toBeInTheDocument()
    expect(saves).toHaveLength(2)
    expect(saves[1]).toMatchObject({
      method: 'PATCH',
      url: '/api/spaces/draft-1',
      body: { name: 'Sala Alameda', communeId: 2, address: 'Av. Libertador 1234', addressDetail: 'Oficina 301' },
    })

    await userEvent.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(await screen.findByText('Paso 2 de 5 · Ubicación')).toBeInTheDocument()
    expect(screen.getByLabelText('Dirección pública')).toHaveValue('Av. Libertador 1234')
    expect(screen.getByLabelText('Comuna')).toHaveValue('2')
  })

  it('en el paso de precios rechaza un valor inválido sin guardar', async () => {
    await openForm()
    await userEvent.type(screen.getByLabelText('Nombre del espacio'), 'Sala')
    await next()
    await screen.findByText('Paso 2 de 5 · Ubicación')
    await next()
    await screen.findByText('Paso 3 de 5 · Precio y horario')
    const saves = spyOnSaves()

    await userEvent.type(screen.getByLabelText('Precio por hora (CLP)'), '0')
    await next()

    expect(await screen.findByText('El precio por hora debe ser un número entero mayor que 0.')).toBeInTheDocument()
    expect(screen.getByText('Paso 3 de 5 · Precio y horario')).toBeInTheDocument()
    expect(saves).toEqual([])
  })

  it('la lista "Para publicar necesitas" se va completando con lo que se escribe', async () => {
    await openForm()
    const aside = screen.getByRole('complementary', { name: 'Estado del borrador' })
    const item = (label: string) => within(aside).getByText(label).closest('li')!
    expect(item('Capacidad')).toHaveTextContent('Pendiente')

    await userEvent.type(screen.getByLabelText('Capacidad (personas)'), '10')
    await userEvent.type(screen.getByLabelText('Descripción'), 'Luminosa')

    expect(item('Capacidad')).toHaveTextContent('Listo')
    expect(item('Descripción')).toHaveTextContent('Listo')
    expect(item('Precio por hora o por día')).toHaveTextContent('Pendiente')
    expect(item('Al menos una foto')).toHaveTextContent('Pendiente')
  })

  it('el último paso resume el borrador y todavía no deja publicar', async () => {
    await openForm()
    await userEvent.type(screen.getByLabelText('Nombre del espacio'), 'Sala Alameda')
    await userEvent.type(screen.getByLabelText('Capacidad (personas)'), '10')
    await userEvent.click(screen.getByRole('button', { name: /Revisar/ }))

    expect(await screen.findByText('Paso 5 de 5 · Revisar')).toBeInTheDocument()
    expect(screen.getByText('Sala Alameda')).toBeInTheDocument()
    expect(screen.getByText('10 personas')).toBeInTheDocument()
    expect(screen.getAllByText('Falta').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Publicar espacio' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument()
  })

  it('si el servidor rechaza el guardado muestra el mensaje y no avanza', async () => {
    server.use(
      mswHttp.post('*/api/spaces', () => HttpResponse.json({ message: 'El tipo de espacio no existe' }, { status: 400 })),
    )
    await openForm()
    await userEvent.type(screen.getByLabelText('Nombre del espacio'), 'Sala')

    await next()

    expect(await screen.findByRole('alert')).toHaveTextContent('El tipo de espacio no existe')
    expect(screen.getByText('Paso 1 de 5 · Información')).toBeInTheDocument()
    expect(screen.queryByText('Borrador guardado')).not.toBeInTheDocument()
  })

  it('un borrador abierto por su dirección carga los datos guardados y sigue actualizándolo', async () => {
    const saves = spyOnSaves()
    server.use(
      mswHttp.get('*/api/spaces/draft-9', () =>
        HttpResponse.json({
          id: 'draft-9', status: 'DRAFT', name: 'Mi borrador', typeId: 2, description: 'Texto', capacity: 6,
          pricePerHour: 7000, pricePerDay: null, regionId: 1, communeId: 3, address: 'Calle 1', addressDetail: null,
          rules: null, amenityIds: [2], createdAt: '2026-10-05T00:00:00.000Z', updatedAt: '2026-10-05T00:00:00.000Z',
        }),
      ),
      mswHttp.patch('*/api/spaces/draft-9', () => HttpResponse.json({})),
    )
    await openForm('/publish/draft-9')

    expect(screen.getByLabelText('Nombre del espacio')).toHaveValue('Mi borrador')
    expect(screen.getByLabelText('Tipo de espacio')).toHaveValue('2')
    expect(screen.getByLabelText('Capacidad (personas)')).toHaveValue(6)
    expect(screen.getByRole('button', { name: 'Proyector' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Borrador guardado')).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Nombre del espacio'))
    await userEvent.type(screen.getByLabelText('Nombre del espacio'), 'Renombrado')
    await next()

    await screen.findByText('Paso 2 de 5 · Ubicación')
    expect(saves).toHaveLength(1)
    expect(saves[0]).toMatchObject({ method: 'PATCH', url: '/api/spaces/draft-9', body: { name: 'Renombrado', capacity: 6 } })
  })

  it('un borrador que no existe o no es del usuario muestra un aviso con salida', async () => {
    renderPublish('/publish/no-existe')

    expect(await screen.findByRole('heading', { name: 'No encontramos este borrador' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Publicar un espacio nuevo' })).toHaveAttribute('href', '/publish')
  })

  it('ir de nuevo a /publish desde un borrador abre un formulario vacío', async () => {
    const router = await openForm()
    await userEvent.type(screen.getByLabelText('Nombre del espacio'), 'Sala Alameda')
    await next()
    await screen.findByText('Paso 2 de 5 · Ubicación')
    expect(router.state.location.pathname).toBe('/publish/draft-1')

    await act(() => router.navigate('/publish'))

    await waitFor(() => expect(screen.getByLabelText('Nombre del espacio')).toHaveValue(''))
    expect(screen.getByText('Paso 1 de 5 · Información')).toBeInTheDocument()
  })

  it('si falla la carga muestra el error y permite reintentar', async () => {
    let calls = 0
    server.use(
      mswHttp.get('*/api/amenities', () => {
        calls += 1
        return calls === 1 ? HttpResponse.json({ message: 'Servicio caído' }, { status: 500 }) : HttpResponse.json([{ id: 1, name: 'Wifi' }])
      }),
    )
    renderPublish()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No pudimos cargar el formulario.')

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Publica tu espacio' })).toBeInTheDocument()
  })
})
