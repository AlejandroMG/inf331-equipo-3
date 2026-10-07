import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http as mswHttp, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '../../components/ToastProvider'
import { server } from '../../mocks/server'
import { AdminSpacesPage } from './AdminSpacesPage'
import type { AdminSpace } from './types'

const space = (overrides: Partial<AdminSpace> = {}): AdminSpace => ({
  id: 's1',
  name: 'Sala Alameda',
  status: 'ACTIVE',
  ownerName: 'Pía Propietaria',
  ownerEmail: 'pia@correo.test',
  typeName: 'Sala de reuniones',
  communeName: 'Santiago',
  blockedReason: null,
  blockedAt: null,
  updatedAt: '2026-10-05T12:00:00.000Z',
  ...overrides,
})

function serveList(items: AdminSpace[], total = items.length) {
  const queries: URLSearchParams[] = []
  server.use(
    mswHttp.get('*/api/admin/spaces', ({ request }) => {
      const url = new URL(request.url)
      queries.push(url.searchParams)
      return HttpResponse.json({ items, total, page: Number(url.searchParams.get('page')) || 1, pageSize: 20 })
    }),
  )
  return queries
}

function renderPage(path = '/admin/spaces') {
  const router = createMemoryRouter(
    [
      { path: 'admin/spaces', element: <AdminSpacesPage /> },
      { path: 'admin/space-types', element: <h1>Tipos</h1> },
    ],
    { initialEntries: [path] },
  )
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )
  return router
}

const rowOf = async (name: string) => (await screen.findByRole('heading', { level: 2, name })).closest('li')!

/** Cuenta las peticiones de bloqueo que llegan a la API simulada, sin cambiar su respuesta. */
function countBlocks() {
  const state = { calls: 0 }
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'POST' && new URL(request.url).pathname.endsWith('/block')) state.calls += 1
  })
  return state
}

describe('AdminSpacesPage (AD-02)', () => {
  it('lista los espacios con su estado, su tipo y comuna, y su propietario', async () => {
    serveList([space(), space({ id: 's2', name: 'Borrador X', status: 'DRAFT', typeName: null, communeName: null })])
    renderPage()

    const row = await rowOf('Sala Alameda')

    expect(within(row).getByText('Activo')).toBeInTheDocument()
    expect(within(row).getByText('Sala de reuniones · Santiago')).toBeInTheDocument()
    expect(within(row).getByText('Pía Propietaria · pia@correo.test')).toBeInTheDocument()
    expect(within(await rowOf('Borrador X')).getByText('Sin tipo ni comuna')).toBeInTheDocument()
    expect(screen.getByText('2 espacios')).toBeInTheDocument()
  })

  it('un espacio bloqueado muestra su motivo; un borrador no ofrece bloquear', async () => {
    serveList([space({ status: 'BLOCKED', blockedReason: 'Las fotos no corresponden' }), space({ id: 's2', name: 'Borrador X', status: 'DRAFT' })])
    renderPage()

    expect(within(await rowOf('Sala Alameda')).getByText('Motivo: Las fotos no corresponden')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desbloquear Sala Alameda' })).toBeInTheDocument()
    expect(within(await rowOf('Borrador X')).queryByRole('button')).not.toBeInTheDocument()
  })

  it('tiene la navegación de administración con "Espacios" como la página actual', async () => {
    serveList([])
    renderPage()

    const nav = await screen.findByRole('navigation', { name: 'Administración' })

    expect(within(nav).getByRole('link', { name: 'Espacios' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Tipos de espacio' })).toHaveAttribute('href', '/admin/space-types')
  })

  describe('bloquear', () => {
    it('pide un motivo y bloquea: la fila pasa a Bloqueado con su motivo', async () => {
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: 'Bloquear Sala Alameda' }))
      const dialog = screen.getByRole('dialog', { name: '¿Bloquear este espacio?' })

      await userEvent.type(within(dialog).getByLabelText('Motivo'), 'Las fotos no corresponden al espacio')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Bloquear' }))

      const row = await rowOf('Sala Alameda')
      await waitFor(() => expect(within(row).getByText('Bloqueado')).toBeInTheDocument())
      expect(within(row).getByText('Motivo: Las fotos no corresponden al espacio')).toBeInTheDocument()
      expect(within(row).getByRole('button', { name: 'Desbloquear Sala Alameda' })).toBeInTheDocument()
      expect(await screen.findByText(/«Sala Alameda» quedó bloqueado y salió del catálogo/)).toBeInTheDocument()
    })

    it.each([
      ['sin motivo', ''],
      ['con un motivo muy corto', 'no'],
      ['con un motivo solo de espacios', '      '],
    ])('%s no bloquea y lo pide', async (_name, text) => {
      const blocks = countBlocks()
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: 'Bloquear Sala Alameda' }))
      const dialog = screen.getByRole('dialog', { name: '¿Bloquear este espacio?' })
      if (text) await userEvent.type(within(dialog).getByLabelText('Motivo'), text)

      await userEvent.click(within(dialog).getByRole('button', { name: 'Bloquear' }))

      expect(within(dialog).getByText('Escribe un motivo de 5 a 500 caracteres.')).toBeInTheDocument()
      expect(within(dialog).getByLabelText('Motivo')).toHaveAttribute('aria-invalid', 'true')
      expect(blocks.calls).toBe(0)
    })

    it('manda el motivo sin los espacios de los bordes', async () => {
      const bodies: unknown[] = []
      server.use(
        mswHttp.post('*/api/admin/spaces/:id/block', async ({ request }) => {
          bodies.push(await request.json())
          return HttpResponse.json(space({ status: 'BLOCKED', blockedReason: 'Un motivo válido' }))
        }),
      )
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: 'Bloquear Sala Alameda' }))
      const dialog = screen.getByRole('dialog', { name: '¿Bloquear este espacio?' })

      await userEvent.type(within(dialog).getByLabelText('Motivo'), '  Un motivo válido  ')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Bloquear' }))

      await waitFor(() => expect(bodies).toEqual([{ reason: 'Un motivo válido' }]))
    })

    it('si el servidor lo rechaza, muestra el mensaje en el diálogo y deja intentarlo de nuevo', async () => {
      server.use(mswHttp.post('*/api/admin/spaces/:id/block', () => HttpResponse.json({ message: 'El espacio ya está bloqueado' }, { status: 409 })))
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: 'Bloquear Sala Alameda' }))
      const dialog = screen.getByRole('dialog', { name: '¿Bloquear este espacio?' })
      await userEvent.type(within(dialog).getByLabelText('Motivo'), 'Un motivo válido')

      await userEvent.click(within(dialog).getByRole('button', { name: 'Bloquear' }))

      expect(await within(dialog).findByText('El espacio ya está bloqueado')).toBeInTheDocument()
      expect(dialog).toHaveAttribute('open')
    })

    it('cancelar cierra el diálogo sin bloquear', async () => {
      const blocks = countBlocks()
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: 'Bloquear Sala Alameda' }))

      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

      expect(screen.queryByRole('dialog', { name: '¿Bloquear este espacio?' })).not.toBeInTheDocument()
      expect(blocks.calls).toBe(0)
    })
  })

  describe('desbloquear', () => {
    it('confirma y deja el espacio inactivo, sin motivo', async () => {
      serveList([space({ status: 'BLOCKED', blockedReason: 'Un motivo válido' })])
      server.use(mswHttp.post('*/api/admin/spaces/:id/unblock', () => HttpResponse.json(space({ status: 'INACTIVE' }))))
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: 'Desbloquear Sala Alameda' }))
      const dialog = screen.getByRole('dialog', { name: '¿Desbloquear este espacio?' })
      expect(within(dialog).getByText(/su propietario decide cuándo volver a activarlo/)).toBeInTheDocument()

      await userEvent.click(within(dialog).getByRole('button', { name: 'Desbloquear' }))

      const row = await rowOf('Sala Alameda')
      await waitFor(() => expect(within(row).getByText('Inactivo')).toBeInTheDocument())
      expect(within(row).queryByText(/Motivo/)).not.toBeInTheDocument()
    })

    it('si falla, avisa y deja el espacio bloqueado', async () => {
      serveList([space({ status: 'BLOCKED', blockedReason: 'Un motivo válido' })])
      server.use(mswHttp.post('*/api/admin/spaces/:id/unblock', () => HttpResponse.json({ message: 'El espacio no está bloqueado' }, { status: 409 })))
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: 'Desbloquear Sala Alameda' }))

      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desbloquear' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('El espacio no está bloqueado')
      expect(within(await rowOf('Sala Alameda')).getByText('Bloqueado')).toBeInTheDocument()
    })
  })

  describe('filtros', () => {
    it('sin filtros no manda estado ni texto', async () => {
      const queries = serveList([space()])
      renderPage()
      await rowOf('Sala Alameda')

      expect(queries[0].has('status')).toBe(false)
      expect(queries[0].has('q')).toBe(false)
    })

    it('elegir un estado lo manda y lo deja en la URL', async () => {
      const queries = serveList([space()])
      const router = renderPage()
      await rowOf('Sala Alameda')

      await userEvent.selectOptions(screen.getByLabelText('Estado'), 'Bloqueado')

      await waitFor(() => expect(queries.at(-1)?.get('status')).toBe('BLOCKED'))
      expect(router.state.location.search).toBe('?status=BLOCKED')
    })

    it('el texto se busca al enviar, no en cada tecla', async () => {
      const queries = serveList([space()])
      const router = renderPage()
      await rowOf('Sala Alameda')

      await userEvent.type(screen.getByLabelText('Buscar'), 'pia')
      expect(queries).toHaveLength(1)
      await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))

      await waitFor(() => expect(queries.at(-1)?.get('q')).toBe('pia'))
      expect(router.state.location.search).toBe('?q=pia')
    })

    it('abre con los filtros de la URL ya aplicados', async () => {
      const queries = serveList([space()])
      renderPage('/admin/spaces?status=ACTIVE&q=sala')
      await rowOf('Sala Alameda')

      expect(screen.getByLabelText('Estado')).toHaveValue('ACTIVE')
      expect(screen.getByLabelText('Buscar')).toHaveValue('sala')
      expect(queries[0].get('status')).toBe('ACTIVE')
    })

    it('un estado inválido en la URL se ignora', async () => {
      const queries = serveList([space()])
      renderPage('/admin/spaces?status=ACEPTADO&page=abc')
      await rowOf('Sala Alameda')

      expect(queries[0].has('status')).toBe(false)
      expect(queries[0].get('page')).toBe('1')
    })

    it('sin resultados lo dice', async () => {
      serveList([])
      renderPage('/admin/spaces?q=zzz')

      expect(await screen.findByRole('heading', { level: 2, name: 'No hay espacios con esos filtros' })).toBeInTheDocument()
    })
  })

  it('pagina y sus enlaces conservan los filtros', async () => {
    const queries = serveList([space()], 45)
    renderPage('/admin/spaces?status=ACTIVE&page=2')
    await rowOf('Sala Alameda')

    expect(queries[0].get('page')).toBe('2')
    expect(screen.getByRole('link', { name: 'Página 3' })).toHaveAttribute('href', '/admin/spaces?status=ACTIVE&page=3')
  })

  it('si falla la carga muestra el error y deja reintentar', async () => {
    let fails = true
    server.use(
      mswHttp.get('*/api/admin/spaces', () =>
        fails ? HttpResponse.json({ message: 'Solo para administradores' }, { status: 403 }) : HttpResponse.json({ items: [space()], total: 1, page: 1, pageSize: 20 }),
      ),
    )
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Solo para administradores')
    fails = false
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await rowOf('Sala Alameda')).toBeInTheDocument()
  })

  it('muestra un estado de carga', () => {
    serveList([])
    renderPage()

    expect(screen.getByRole('status', { name: 'Cargando espacios' })).toBeInTheDocument()
  })
})
