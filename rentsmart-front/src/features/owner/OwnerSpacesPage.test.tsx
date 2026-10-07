import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http as mswHttp, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '../../components/ToastProvider'
import { server } from '../../mocks/server'
import { OwnerSpacesPage } from './OwnerSpacesPage'
import type { OwnerSpaceSummary } from './types'

const summary = (overrides: Partial<OwnerSpaceSummary> = {}): OwnerSpaceSummary => ({
  id: 's1',
  status: 'ACTIVE',
  name: 'Sala Alameda',
  typeName: 'Sala de reuniones',
  communeName: 'Santiago',
  pricePerHour: 12000,
  pricePerDay: null,
  coverUrl: null,
  missing: [],
  updatedAt: '2026-10-05T12:00:00.000Z',
  ...overrides,
})

const serveSpaces = (list: OwnerSpaceSummary[]) => server.use(mswHttp.get('*/api/spaces/me', () => HttpResponse.json(list)))

/** Guarda los cambios de estado que recibe la API y responde como el back, con el espacio ya cambiado. */
function serveStatusChanges() {
  const calls: Array<{ id: string; body: unknown }> = []
  server.use(
    mswHttp.patch('*/api/spaces/:id/status', async ({ params, request }) => {
      const body = (await request.json()) as { status: string }
      calls.push({ id: String(params.id), body })
      return HttpResponse.json({ id: params.id, status: body.status })
    }),
  )
  return calls
}

function renderPanel() {
  const router = createMemoryRouter(
    [
      { path: 'owner/spaces', element: <OwnerSpacesPage /> },
      { path: 'publish/:spaceId?', element: <h1>Formulario</h1> },
    ],
    { initialEntries: ['/owner/spaces'] },
  )
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )
  return router
}

async function openPanel(list: OwnerSpaceSummary[]) {
  serveSpaces(list)
  const router = renderPanel()
  await screen.findByRole('heading', { level: 2, name: list.length > 0 ? 'Publicaciones' : 'Todavía no tienes espacios' })
  return router
}

const tile = (label: string) => screen.getByText(label).parentElement as HTMLElement
// Su nombre accesible es el texto visible ("Activo" o "Inactivo") más el del espacio.
const switchOf = (name: string) => screen.getByRole('switch', { name: (accessibleName) => accessibleName.endsWith(` ${name}`) })

describe('OwnerSpacesPage', () => {
  it('mientras carga muestra un estado de carga, y después la lista', async () => {
    serveSpaces([summary()])
    renderPanel()

    expect(screen.getByRole('status', { name: 'Cargando tus espacios' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 3, name: 'Sala Alameda' })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Cargando tus espacios' })).not.toBeInTheDocument()
  })

  it('sin espacios invita a publicar el primero', async () => {
    await openPanel([])

    expect(screen.getByRole('link', { name: 'Publicar un espacio' })).toHaveAttribute('href', '/publish')
    expect(screen.queryByRole('list', { name: 'Resumen' })).not.toBeInTheDocument()
  })

  it('siempre ofrece publicar un espacio nuevo', async () => {
    await openPanel([summary()])

    expect(screen.getByRole('link', { name: 'Publicar nuevo espacio' })).toHaveAttribute('href', '/publish')
  })

  it('muestra cada espacio con su estado, su tipo, comuna y precio, y la portada', async () => {
    await openPanel([summary({ coverUrl: '/api/uploads/spaces/a.png' }), summary({ id: 's2', name: 'Estudio Luz', status: 'INACTIVE' })])

    const rows = screen.getAllByRole('listitem').filter((item) => within(item).queryByRole('heading', { level: 3 }))
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('Activo', { selector: 'span.rounded-full' })).toBeInTheDocument()
    expect(within(rows[0]).getByText('Sala de reuniones · Santiago · $12.000 / hora')).toBeInTheDocument()
    expect(rows[0].querySelector('img')).toHaveAttribute('src', '/api/uploads/spaces/a.png')
    expect(within(rows[1]).getByText('Inactivo', { selector: 'span.rounded-full' })).toBeInTheDocument()
  })

  it('cuenta los espacios por estado', async () => {
    await openPanel([
      summary(),
      summary({ id: 's2', status: 'ACTIVE' }),
      summary({ id: 's3', status: 'INACTIVE' }),
      summary({ id: 's4', status: 'DRAFT', missing: ['photos'] }),
    ])

    expect(tile('Activos en el catálogo')).toHaveTextContent('2')
    expect(tile('Inactivos')).toHaveTextContent('1')
    expect(tile('Borradores')).toHaveTextContent('1')
    expect(screen.queryByText('Bloqueados')).not.toBeInTheDocument()
  })

  it('un borrador dice lo que le falta y se completa desde el formulario, sin interruptor', async () => {
    await openPanel([summary({ id: 's3', name: 'Taller San Miguel', status: 'DRAFT', typeName: null, communeName: null, pricePerHour: null, missing: ['photos', 'price', 'schedule'] })])

    expect(screen.getByText('Falta: foto, precio y horario')).toBeInTheDocument()
    expect(screen.getByText('Sin precio todavía')).toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Completar Taller San Miguel' })).toHaveAttribute('href', '/publish/s3')
  })

  it('un espacio publicado se edita desde el formulario', async () => {
    await openPanel([summary()])

    expect(screen.getByRole('link', { name: 'Editar Sala Alameda' })).toHaveAttribute('href', '/publish/s1')
    expect(screen.queryByText(/^Falta:/)).not.toBeInTheDocument()
  })

  it('el nombre accesible del interruptor contiene el texto que se ve, y sigue al estado', async () => {
    serveStatusChanges()
    await openPanel([summary(), summary({ id: 's2', name: 'Estudio Luz', status: 'INACTIVE' })])

    expect(screen.getByRole('switch', { name: 'Activo Sala Alameda' })).toHaveTextContent('Activo')
    expect(screen.getByRole('switch', { name: 'Inactivo Estudio Luz' })).toHaveTextContent('Inactivo')

    await userEvent.click(screen.getByRole('switch', { name: 'Inactivo Estudio Luz' }))

    expect(await screen.findByRole('switch', { name: 'Activo Estudio Luz' })).toBeChecked()
  })

  it('un espacio bloqueado por el administrador no se puede editar ni activar', async () => {
    await openPanel([summary({ status: 'BLOCKED' })])

    expect(screen.getByText('Un administrador bloqueó esta publicación.')).toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Editar/ })).not.toBeInTheDocument()
    expect(tile('Bloqueados')).toHaveTextContent('1')
  })

  describe('desactivar', () => {
    it('pide confirmación y no cambia nada si se cancela', async () => {
      const calls = serveStatusChanges()
      await openPanel([summary()])

      await userEvent.click(switchOf('Sala Alameda'))
      const dialog = screen.getByRole('dialog', { name: '¿Desactivar este espacio?' })
      expect(within(dialog).getByText(/Sala Alameda/)).toBeInTheDocument()
      expect(within(dialog).getByText(/Las reservas ya confirmadas se mantienen/)).toBeInTheDocument()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(switchOf('Sala Alameda')).toBeChecked()
      expect(calls).toEqual([])
    })

    it('al confirmar lo desactiva, actualiza el interruptor y los contadores, y avisa', async () => {
      const calls = serveStatusChanges()
      await openPanel([summary(), summary({ id: 's2', name: 'Estudio Luz' })])

      await userEvent.click(switchOf('Sala Alameda'))
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desactivar' }))

      await waitFor(() => expect(switchOf('Sala Alameda')).not.toBeChecked())
      expect(calls).toEqual([{ id: 's1', body: { status: 'INACTIVE' } }])
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(switchOf('Estudio Luz')).toBeChecked()
      expect(tile('Activos en el catálogo')).toHaveTextContent('1')
      expect(tile('Inactivos')).toHaveTextContent('1')
      expect(await screen.findByText('«Sala Alameda» salió del catálogo.')).toBeInTheDocument()
    })

    it('si el servidor falla, el espacio sigue activo y se muestra el motivo', async () => {
      server.use(
        mswHttp.patch('*/api/spaces/:id/status', () =>
          HttpResponse.json({ message: 'El espacio no existe', statusCode: 404 }, { status: 404 }),
        ),
      )
      await openPanel([summary()])

      await userEvent.click(switchOf('Sala Alameda'))
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desactivar' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('El espacio no existe')
      expect(switchOf('Sala Alameda')).toBeChecked()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('activar', () => {
    it('lo activa sin pedir confirmación', async () => {
      const calls = serveStatusChanges()
      await openPanel([summary({ id: 's2', name: 'Estudio Luz', status: 'INACTIVE' })])

      await userEvent.click(switchOf('Estudio Luz'))

      await waitFor(() => expect(switchOf('Estudio Luz')).toBeChecked())
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(calls).toEqual([{ id: 's2', body: { status: 'ACTIVE' } }])
      expect(tile('Activos en el catálogo')).toHaveTextContent('1')
      expect(await screen.findByText('«Estudio Luz» ya está en el catálogo.')).toBeInTheDocument()
    })

    it('si le falta algo, el servidor lo rechaza y se dice qué falta', async () => {
      server.use(
        mswHttp.patch('*/api/spaces/:id/status', () =>
          HttpResponse.json({ statusCode: 409, message: 'Faltan datos para publicar el espacio', missing: ['photos', 'schedule'] }, { status: 409 }),
        ),
      )
      await openPanel([summary({ id: 's2', name: 'Estudio Luz', status: 'INACTIVE', missing: ['photos', 'schedule'] })])

      await userEvent.click(switchOf('Estudio Luz'))

      expect(await screen.findByRole('alert')).toHaveTextContent('No se puede activar «Estudio Luz»: falta foto y horario.')
      expect(switchOf('Estudio Luz')).not.toBeChecked()
      expect(screen.getByText('Falta: foto y horario')).toBeInTheDocument()
    })

    it('mientras se cambia el estado el interruptor queda bloqueado', async () => {
      let release: () => void = () => {}
      const gate = new Promise<void>((resolve) => (release = resolve))
      server.use(
        mswHttp.patch('*/api/spaces/:id/status', async () => {
          await gate
          return HttpResponse.json({ id: 's2', status: 'ACTIVE' })
        }),
      )
      await openPanel([summary({ id: 's2', name: 'Estudio Luz', status: 'INACTIVE' })])

      await userEvent.click(switchOf('Estudio Luz'))
      expect(switchOf('Estudio Luz')).toBeDisabled()
      release()

      await waitFor(() => expect(switchOf('Estudio Luz')).toBeEnabled())
      expect(switchOf('Estudio Luz')).toBeChecked()
    })
  })

  it('si la carga falla, ofrece reintentar', async () => {
    server.use(mswHttp.get('*/api/spaces/me', () => HttpResponse.json({ message: 'Falló la base' }, { status: 500 })))
    renderPanel()

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tus espacios.')

    serveSpaces([summary()])
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('heading', { level: 3, name: 'Sala Alameda' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('deja en claro que las reservas llegarán con la reserva en línea', async () => {
    await openPanel([summary()])

    expect(screen.getByRole('heading', { level: 2, name: 'Próximas reservas' })).toBeInTheDocument()
    expect(screen.getByText(/Todavía no hay reservas para mostrar/)).toBeInTheDocument()
  })
})
