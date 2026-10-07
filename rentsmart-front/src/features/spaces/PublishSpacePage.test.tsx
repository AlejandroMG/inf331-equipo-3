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
      // Publicar no manda cuerpo y las fotos mandan un formulario: solo los JSON se leen.
      const text = await request.clone().text()
      let body: Record<string, unknown> = {}
      try {
        body = JSON.parse(text)
      } catch {
        // sin cuerpo o no JSON
      }
      calls.push({ method: request.method, url: new URL(request.url).pathname, body })
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
  it('si el nombre falta, el foco pasa al campo con el error para que un lector de pantalla lo anuncie', async () => {
    await openForm()

    await next()

    const name = await screen.findByLabelText('Nombre del espacio')
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveFocus()
    expect(screen.getByText('Ponle un nombre a tu espacio.')).toBeInTheDocument()
  })

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

  it('el último paso resume el borrador y ofrece publicarlo', async () => {
    await openForm()
    await userEvent.type(screen.getByLabelText('Nombre del espacio'), 'Sala Alameda')
    await userEvent.type(screen.getByLabelText('Capacidad (personas)'), '10')
    await userEvent.click(screen.getByRole('button', { name: /Revisar/ }))

    expect(await screen.findByText('Paso 5 de 5 · Revisar')).toBeInTheDocument()
    expect(screen.getByText('Sala Alameda')).toBeInTheDocument()
    expect(screen.getByText('10 personas')).toBeInTheDocument()
    expect(screen.getAllByText('Falta').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Publicar espacio' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  describe('publicar', () => {
    /** Llena un borrador con lo necesario (menos fotos) y llega al último paso. */
    async function fillAndReview({ withPhoto = true, price = '12000' }: { withPhoto?: boolean; price?: string } = {}) {
      const router = await openForm()
      await userEvent.type(screen.getByLabelText('Nombre del espacio'), 'Sala Alameda')
      await userEvent.selectOptions(screen.getByLabelText('Tipo de espacio'), 'Sala de reuniones')
      await userEvent.type(screen.getByLabelText('Descripción'), 'Luminosa')
      await userEvent.type(screen.getByLabelText('Capacidad (personas)'), '10')
      await next()
      await screen.findByText('Paso 2 de 5 · Ubicación')
      await userEvent.selectOptions(screen.getByLabelText('Comuna'), 'Providencia')
      await next()
      await screen.findByText('Paso 3 de 5 · Precio y horario')
      if (price) await userEvent.type(screen.getByLabelText('Precio por hora (CLP)'), price)
      await next()
      await screen.findByText('Paso 4 de 5 · Fotos')
      if (withPhoto) {
        await userEvent.upload(screen.getByLabelText('Elegir fotos'), new File(['x'], 'sala.png', { type: 'image/png' }))
        await screen.findByRole('img', { name: 'Foto 1' })
      }
      await userEvent.click(screen.getByRole('button', { name: /Revisar/ }))
      await screen.findByText('Paso 5 de 5 · Revisar')
      return router
    }

    it('con todo completo publica y muestra el espacio con enlaces al catálogo y a Mis espacios', async () => {
      await fillAndReview()

      await userEvent.click(screen.getByRole('button', { name: 'Publicar espacio' }))

      expect(await screen.findByRole('status')).toHaveTextContent('¡Tu espacio está publicado!')
      expect(screen.getByText(/“Sala Alameda” ya aparece en el catálogo/)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Ver en el catálogo' })).toHaveAttribute('href', '/spaces/draft-1')
      expect(screen.getByRole('link', { name: 'Ir a mis espacios' })).toHaveAttribute('href', '/owner/spaces')
      expect(screen.getByRole('link', { name: 'Publicar otro espacio' })).toHaveAttribute('href', '/publish')
      expect(screen.queryByLabelText('Nombre del espacio')).not.toBeInTheDocument()
    })

    it('publica el borrador ya guardado sin volver a guardarlo', async () => {
      await fillAndReview()
      const saves = spyOnSaves()

      await userEvent.click(screen.getByRole('button', { name: 'Publicar espacio' }))

      await screen.findByRole('status')
      // Cada cambio de paso ya guardó el borrador: al publicar solo se pide publicar.
      expect(saves.map((c) => `${c.method} ${c.url}`)).toEqual(['POST /api/spaces/draft-1/publish'])
    })

    it('si falta algo muestra qué y lleva al paso donde se completa', async () => {
      await fillAndReview({ withPhoto: false, price: '' })

      await userEvent.click(screen.getByRole('button', { name: 'Publicar espacio' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Aún no puedes publicar. Te falta:')
      expect(within(alert).getByText(/Precio por hora o por día/)).toBeInTheDocument()
      expect(within(alert).getByText(/Al menos una foto/)).toBeInTheDocument()
      expect(screen.getByText('Paso 5 de 5 · Revisar')).toBeInTheDocument()

      await userEvent.click(within(alert).getByRole('button', { name: 'Ir al paso 3' }))

      expect(await screen.findByText('Paso 3 de 5 · Precio y horario')).toBeInTheDocument()
    })

    it('el horario semanal faltante se avisa sin enlace, porque todavía no se puede cargar', async () => {
      server.use(
        mswHttp.post('*/api/spaces/:id/publish', () =>
          HttpResponse.json({ statusCode: 409, message: 'Faltan datos', missing: ['schedule'] }, { status: 409 }),
        ),
      )
      await fillAndReview()

      await userEvent.click(screen.getByRole('button', { name: 'Publicar espacio' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Horario semanal (se podrá cargar pronto)')
      expect(within(alert).queryByRole('button')).not.toBeInTheDocument()
    })

    it('el aviso de lo que falta se va al volver a guardar', async () => {
      await fillAndReview({ withPhoto: false })
      await userEvent.click(screen.getByRole('button', { name: 'Publicar espacio' }))
      await screen.findByRole('alert')

      await userEvent.click(screen.getByRole('button', { name: /Información/ }))
      await screen.findByText('Paso 1 de 5 · Información')
      await userEvent.type(screen.getByLabelText('Reglas del espacio (opcional)'), 'x')
      await userEvent.click(screen.getByRole('button', { name: /Revisar/ }))
      await screen.findByText('Paso 5 de 5 · Revisar')

      expect(screen.queryByText('Aún no puedes publicar. Te falta:')).not.toBeInTheDocument()
    })

    it('un error que no es de datos faltantes se muestra tal cual', async () => {
      server.use(mswHttp.post('*/api/spaces/:id/publish', () => HttpResponse.json({ message: 'Servicio caído' }, { status: 500 })))
      await fillAndReview()

      await userEvent.click(screen.getByRole('button', { name: 'Publicar espacio' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Servicio caído')
      expect(screen.getByRole('button', { name: 'Publicar espacio' })).toBeEnabled()
    })

    it.each([
      ['ACTIVE', 'Este espacio ya está publicado'],
      ['INACTIVE', 'Este espacio está desactivado'],
      ['BLOCKED', 'Un administrador bloqueó esta publicación'],
    ])('un espacio %s se edita, no se publica', async (status, message) => {
      server.use(
        mswHttp.get('*/api/spaces/draft-7', () =>
          HttpResponse.json({
            id: 'draft-7', status, name: 'Publicado', typeId: 1, description: 'x', capacity: 5, pricePerHour: 5000, pricePerDay: null,
            regionId: 1, communeId: 1, address: null, addressDetail: null, rules: null, amenityIds: [], photos: [],
            createdAt: '2026-10-05T00:00:00.000Z', updatedAt: '2026-10-05T00:00:00.000Z',
          }),
        ),
      )
      renderPublish('/publish/draft-7')
      expect(await screen.findByRole('heading', { level: 1, name: 'Edita tu espacio' })).toBeInTheDocument()
      expect(screen.getByText('Cambios guardados')).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: /Revisar/ }))

      expect(await screen.findByText(new RegExp(message))).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Publicar espacio' })).not.toBeInTheDocument()
    })
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

  it('en el paso de fotos se sube una foto y la lista y el resumen lo reflejan', async () => {
    await openForm()
    await userEvent.type(screen.getByLabelText('Nombre del espacio'), 'Sala Alameda')
    await userEvent.click(screen.getByRole('button', { name: /Fotos/ }))
    expect(await screen.findByText('Paso 4 de 5 · Fotos')).toBeInTheDocument()
    const aside = screen.getByRole('complementary', { name: 'Estado del borrador' })
    expect(within(aside).getByText('Al menos una foto').closest('li')).toHaveTextContent('Pendiente')

    await userEvent.upload(screen.getByLabelText('Elegir fotos'), new File(['x'], 'sala.png', { type: 'image/png' }))

    expect(await screen.findByRole('img', { name: 'Foto 1' })).toBeInTheDocument()
    expect(within(aside).getByText('Al menos una foto').closest('li')).toHaveTextContent('Listo')
    await userEvent.click(screen.getByRole('button', { name: /Revisar/ }))
    expect(await screen.findByText('1 foto')).toBeInTheDocument()
  })

  it('las fotos subidas siguen ahí al volver al paso y al continuar el borrador', async () => {
    const router = await openForm()
    await userEvent.type(screen.getByLabelText('Nombre del espacio'), 'Sala Alameda')
    await userEvent.click(screen.getByRole('button', { name: /Fotos/ }))
    await screen.findByText('Paso 4 de 5 · Fotos')
    await userEvent.upload(screen.getByLabelText('Elegir fotos'), new File(['x'], 'sala.png', { type: 'image/png' }))
    await screen.findByRole('img', { name: 'Foto 1' })

    await userEvent.click(screen.getByRole('button', { name: 'Atrás' }))
    await screen.findByText('Paso 3 de 5 · Precio y horario')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByRole('img', { name: 'Foto 1' })).toBeInTheDocument()

    // Abrir el mismo borrador por su dirección carga las fotos guardadas en el servidor.
    await act(() => router.navigate('/publish/draft-1', { replace: true }))
    await userEvent.click(await screen.findByRole('button', { name: /Fotos/ }))
    expect(await screen.findByRole('img', { name: 'Foto 1' })).toBeInTheDocument()
    expect(screen.getByText('1 de 10 fotos')).toBeInTheDocument()
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
