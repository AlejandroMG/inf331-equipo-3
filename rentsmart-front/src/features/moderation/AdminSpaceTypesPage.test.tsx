import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http as mswHttp, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '../../components/ToastProvider'
import { server } from '../../mocks/server'
import { AdminSpaceTypesPage } from './AdminSpaceTypesPage'

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: 'admin/space-types', element: <AdminSpaceTypesPage /> },
      { path: 'admin/spaces', element: <h1>Espacios</h1> },
    ],
    { initialEntries: ['/admin/space-types'] },
  )
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )
}

const rowOf = async (name: string) => (await screen.findByRole('heading', { level: 2, name })).closest('li')!

describe('AdminSpaceTypesPage (AD-02)', () => {
  it('lista los tipos con cuántos espacios usa cada uno', async () => {
    server.use(
      mswHttp.get('*/api/admin/space-types', () =>
        HttpResponse.json([
          { id: 1, name: 'Sala de reuniones', spaces: 4 },
          { id: 2, name: 'Cancha', spaces: 1 },
          { id: 3, name: 'Taller', spaces: 0 },
        ]),
      ),
    )
    renderPage()

    expect(within(await rowOf('Sala de reuniones')).getByText('4 espacios')).toBeInTheDocument()
    expect(within(await rowOf('Cancha')).getByText('1 espacio')).toBeInTheDocument()
    expect(within(await rowOf('Taller')).getByText('0 espacios')).toBeInTheDocument()
  })

  it('tiene la navegación de administración con "Tipos de espacio" como la página actual', async () => {
    renderPage()

    const nav = await screen.findByRole('navigation', { name: 'Administración' })

    expect(within(nav).getByRole('link', { name: 'Tipos de espacio' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Espacios' })).toHaveAttribute('href', '/admin/spaces')
  })

  describe('crear', () => {
    it('agrega un tipo, lo suma a la lista y vacía el campo', async () => {
      renderPage()
      await rowOf('Cancha')

      await userEvent.type(screen.getByLabelText('Nombre del nuevo tipo'), 'Estudio de danza')
      await userEvent.click(screen.getByRole('button', { name: 'Agregar tipo' }))

      expect(within(await rowOf('Estudio de danza')).getByText('0 espacios')).toBeInTheDocument()
      expect(screen.getByLabelText('Nombre del nuevo tipo')).toHaveValue('')
      expect(await screen.findByText('Se agregó el tipo «Estudio de danza».')).toBeInTheDocument()
    })

    it('manda el nombre sin los espacios de más', async () => {
      const bodies: unknown[] = []
      server.use(
        mswHttp.post('*/api/admin/space-types', async ({ request }) => {
          bodies.push(await request.json())
          return HttpResponse.json({ id: 99, name: 'Estudio de danza', spaces: 0 }, { status: 201 })
        }),
      )
      renderPage()
      await rowOf('Cancha')

      await userEvent.type(screen.getByLabelText('Nombre del nuevo tipo'), '   Estudio    de   danza  ')
      await userEvent.click(screen.getByRole('button', { name: 'Agregar tipo' }))

      await waitFor(() => expect(bodies).toEqual([{ name: 'Estudio de danza' }]))
    })

    it.each([
      ['vacío', ''],
      ['de una letra', 'a'],
      ['en blanco', '     '],
    ])('un nombre %s no se manda y lo pide', async (_name, text) => {
      renderPage()
      await rowOf('Cancha')
      if (text) await userEvent.type(screen.getByLabelText('Nombre del nuevo tipo'), text)

      await userEvent.click(screen.getByRole('button', { name: 'Agregar tipo' }))

      expect(await screen.findByText('El nombre debe tener de 2 a 60 caracteres.')).toBeInTheDocument()
      expect(screen.getByLabelText('Nombre del nuevo tipo')).toHaveAttribute('aria-invalid', 'true')
    })

    it('un nombre repetido muestra el mensaje del servidor junto al campo, y no agrega nada', async () => {
      renderPage()
      await rowOf('Cancha')

      await userEvent.type(screen.getByLabelText('Nombre del nuevo tipo'), 'cancha')
      await userEvent.click(screen.getByRole('button', { name: 'Agregar tipo' }))

      expect(await screen.findByText('Ya existe un tipo de espacio con ese nombre')).toBeInTheDocument()
      expect(screen.getAllByRole('heading', { level: 2, name: /cancha/i })).toHaveLength(1)
    })

    it('si el servidor rechaza un alojamiento, muestra su mensaje', async () => {
      server.use(
        mswHttp.post('*/api/admin/space-types', () =>
          HttpResponse.json({ message: 'No se permiten tipos de alojamiento: aquí se arriendan espacios por hora o por día' }, { status: 400 }),
        ),
      )
      renderPage()
      await rowOf('Cancha')

      await userEvent.type(screen.getByLabelText('Nombre del nuevo tipo'), 'Hotel boutique')
      await userEvent.click(screen.getByRole('button', { name: 'Agregar tipo' }))

      expect(await screen.findByText(/No se permiten tipos de alojamiento/)).toBeInTheDocument()
    })

    it('al escribir de nuevo, el error se quita', async () => {
      renderPage()
      await rowOf('Cancha')
      await userEvent.click(screen.getByRole('button', { name: 'Agregar tipo' }))
      await screen.findByText('El nombre debe tener de 2 a 60 caracteres.')

      await userEvent.type(screen.getByLabelText('Nombre del nuevo tipo'), 'Bodega')

      expect(screen.queryByText('El nombre debe tener de 2 a 60 caracteres.')).not.toBeInTheDocument()
    })
  })

  describe('renombrar', () => {
    it('cambia el nombre del tipo en la lista', async () => {
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: 'Renombrar Cancha' }))

      const field = screen.getByLabelText('Nuevo nombre de «Cancha»')
      expect(field).toHaveValue('Cancha')
      await userEvent.clear(field)
      await userEvent.type(field, 'Cancha techada')
      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

      expect(await rowOf('Cancha techada')).toBeInTheDocument()
      expect(screen.queryByLabelText(/Nuevo nombre de/)).not.toBeInTheDocument()
      expect(await screen.findByText('«Cancha» ahora se llama «Cancha techada».')).toBeInTheDocument()
    })

    it('un nombre que ya tiene otro tipo muestra el mensaje y deja seguir editando', async () => {
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: 'Renombrar Cancha' }))

      const field = screen.getByLabelText('Nuevo nombre de «Cancha»')
      await userEvent.clear(field)
      await userEvent.type(field, 'Taller')
      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

      expect(await screen.findByText('Ya existe un tipo de espacio con ese nombre')).toBeInTheDocument()
      expect(screen.getByLabelText('Nuevo nombre de «Cancha»')).toBeInTheDocument()
    })

    it('un nombre muy corto no se manda', async () => {
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: 'Renombrar Cancha' }))
      const field = screen.getByLabelText('Nuevo nombre de «Cancha»')
      await userEvent.clear(field)
      await userEvent.type(field, 'x')

      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

      expect(await screen.findByText('El nombre debe tener de 2 a 60 caracteres.')).toBeInTheDocument()
    })

    it('cancelar vuelve al nombre de antes sin guardar', async () => {
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: 'Renombrar Cancha' }))
      await userEvent.type(screen.getByLabelText('Nuevo nombre de «Cancha»'), ' techada')

      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

      expect(await rowOf('Cancha')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Renombrar Cancha' }))
      expect(screen.getByLabelText('Nuevo nombre de «Cancha»')).toHaveValue('Cancha')
    })
  })

  it('si falla la carga muestra el error y deja reintentar', async () => {
    let fails = true
    server.use(
      mswHttp.get('*/api/admin/space-types', () => (fails ? HttpResponse.json({ message: 'Solo para administradores' }, { status: 403 }) : HttpResponse.json([{ id: 1, name: 'Cancha', spaces: 1 }]))),
    )
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Solo para administradores')
    fails = false
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await rowOf('Cancha')).toBeInTheDocument()
  })

  it('muestra un estado de carga', () => {
    renderPage()

    expect(screen.getByRole('status', { name: 'Cargando tipos' })).toBeInTheDocument()
  })
})
