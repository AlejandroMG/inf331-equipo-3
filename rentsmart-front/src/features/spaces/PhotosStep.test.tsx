import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http as mswHttp, HttpResponse } from 'msw'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { server } from '../../mocks/server'
import { emptyForm, toPayload } from './form'
import { PhotosStep } from './PhotosStep'
import { createSpace } from './spaces-api'
import type { OwnerPhoto } from './types'

// "applyAccept: false" para poder probar archivos que el selector del navegador no dejaría elegir.
const user = () => userEvent.setup({ applyAccept: false })
const png = (name: string, size = 1000) => {
  const file = new File(['x'], name, { type: 'image/png' })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

function Harness({ spaceId, initial = [] }: { spaceId: string; initial?: OwnerPhoto[] }) {
  const [photos, setPhotos] = useState(initial)
  return <PhotosStep spaceId={spaceId} photos={photos} onChange={setPhotos} />
}

/** Crea un borrador en la API simulada y muestra el paso de fotos de ese espacio. */
async function openStep() {
  const { id } = await createSpace(toPayload({ ...emptyForm, name: 'Sala' }, 1))
  render(<Harness spaceId={id} />)
  return { id, input: screen.getByLabelText('Elegir fotos') as HTMLInputElement }
}

const sources = () => screen.queryAllByRole('img').map((img) => img.getAttribute('src'))
const tiles = () => screen.queryAllByRole('listitem').filter((li) => li.querySelector('img'))

/** Cuenta los POST de fotos que recibe la API simulada. */
function countUploads() {
  const state = { count: 0 }
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'POST' && request.url.endsWith('/photos')) state.count += 1
  })
  return state
}

describe('PhotosStep', () => {
  it('sin fotos muestra el contador y ninguna foto', async () => {
    await openStep()

    expect(screen.getByText('0 de 10 fotos')).toBeInTheDocument()
    expect(tiles()).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Agregar fotos' })).toBeEnabled()
  })

  it('sube una foto y la deja como portada', async () => {
    const { input } = await openStep()

    await user().upload(input, png('a.png'))

    expect(await screen.findByRole('img', { name: 'Foto 1' })).toBeInTheDocument()
    expect(screen.getByText('Portada')).toBeInTheDocument()
    expect(screen.getByText('1 de 10 fotos')).toBeInTheDocument()
  })

  it('sube varias a la vez, en el orden elegido', async () => {
    const { input } = await openStep()

    await user().upload(input, [png('a.png'), png('b.png'), png('c.png')])

    await waitFor(() => expect(tiles()).toHaveLength(3))
    expect(screen.getByText('3 de 10 fotos')).toBeInTheDocument()
    expect(screen.getAllByText('Portada')).toHaveLength(1)
  })

  it('rechaza un archivo que no es JPG, PNG o WebP sin pedirle nada al servidor', async () => {
    const uploads = countUploads()
    const { input } = await openStep()

    await user().upload(input, new File(['x'], 'nota.pdf', { type: 'application/pdf' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('nota.pdf: usa una foto JPG, PNG o WebP.')
    expect(uploads.count).toBe(0)
    expect(tiles()).toHaveLength(0)
  })

  it('rechaza una foto de más de 5 MB y sube las demás', async () => {
    const { input } = await openStep()

    await user().upload(input, [png('grande.png', 6 * 1024 * 1024), png('chica.png')])

    expect(await screen.findByRole('alert')).toHaveTextContent('grande.png: pesa más de 5 MB.')
    await waitFor(() => expect(tiles()).toHaveLength(1))
  })

  it('con más de 10 sube las que caben y avisa de las que sobran', async () => {
    const { input } = await openStep()

    await user().upload(input, Array.from({ length: 12 }, (_, i) => png(`f${i}.png`)))

    await waitFor(() => expect(tiles()).toHaveLength(10), { timeout: 5000 })
    expect(await screen.findByRole('alert')).toHaveTextContent('no se subieron 2 fotos por falta de lugar')
    expect(screen.getByRole('button', { name: 'Agregar fotos' })).toBeDisabled()
    expect(screen.getByText('10 de 10 fotos')).toBeInTheDocument()
  }, 15000)

  it('si el servidor falla con una foto, lo dice con el nombre del archivo y sigue con las demás', async () => {
    let calls = 0
    server.use(
      mswHttp.post('*/api/spaces/:id/photos', () => {
        calls += 1
        return calls === 1
          ? HttpResponse.json({ message: 'No se pudo guardar' }, { status: 500 })
          : HttpResponse.json({ id: 'ok', url: 'data:image/png;base64,AAAA', position: 0 }, { status: 201 })
      }),
    )
    const { input } = await openStep()

    await user().upload(input, [png('mala.png'), png('buena.png')])

    expect(await screen.findByRole('alert')).toHaveTextContent('mala.png: No se pudo guardar')
    await waitFor(() => expect(tiles()).toHaveLength(1))
  })

  it('si el espacio ya está lleno (409) deja de intentar con las demás', async () => {
    const uploads = countUploads()
    server.use(
      mswHttp.post('*/api/spaces/:id/photos', () =>
        HttpResponse.json({ message: 'Un espacio puede tener hasta 10 fotos' }, { status: 409 }),
      ),
    )
    const { input } = await openStep()

    await user().upload(input, [png('a.png'), png('b.png'), png('c.png')])

    expect(await screen.findByRole('alert')).toHaveTextContent('a.png: Un espacio puede tener hasta 10 fotos')
    expect(uploads.count).toBe(1)
  })

  describe('con fotos subidas', () => {
    async function withThree() {
      const { input } = await openStep()
      await user().upload(input, [png('a.png'), png('b.png'), png('c.png')])
      await waitFor(() => expect(tiles()).toHaveLength(3))
      return sources()
    }

    it('mover una foto a la izquierda cambia el orden', async () => {
      const [first, second, third] = await withThree()

      await userEvent.click(screen.getByRole('button', { name: 'Mover foto 2 a la izquierda' }))

      await waitFor(() => expect(sources()).toEqual([second, first, third]))
    })

    it('mover a la derecha cambia el orden', async () => {
      const [first, second, third] = await withThree()

      await userEvent.click(screen.getByRole('button', { name: 'Mover foto 1 a la derecha' }))

      await waitFor(() => expect(sources()).toEqual([second, first, third]))
    })

    it('"Hacer portada" pasa la foto al primer lugar', async () => {
      const [first, second, third] = await withThree()

      await userEvent.click(screen.getByRole('button', { name: 'Hacer portada la foto 3' }))

      await waitFor(() => expect(sources()).toEqual([third, first, second]))
      expect(screen.queryByRole('button', { name: 'Hacer portada la foto 1' })).not.toBeInTheDocument()
    })

    it('los extremos no se pueden mover hacia afuera', async () => {
      await withThree()

      expect(screen.getByRole('button', { name: 'Mover foto 1 a la izquierda' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Mover foto 3 a la derecha' })).toBeDisabled()
    })

    it('pide confirmación antes de eliminar y cancelar no borra nada', async () => {
      await withThree()

      await userEvent.click(screen.getByRole('button', { name: 'Eliminar foto 2' }))
      const dialog = screen.getByRole('dialog', { name: '¿Eliminar esta foto?' })
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

      expect(tiles()).toHaveLength(3)
    })

    it('al confirmar borra la foto y las demás suben de lugar', async () => {
      const [first, , third] = await withThree()

      await userEvent.click(screen.getByRole('button', { name: 'Eliminar foto 2' }))
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }))

      await waitFor(() => expect(tiles()).toHaveLength(2))
      expect(sources()).toEqual([first, third])
      expect(screen.getByText('2 de 10 fotos')).toBeInTheDocument()
    })

    it('si el servidor rechaza el orden, lo avisa y deja las fotos como estaban', async () => {
      const before = await withThree()
      server.use(
        mswHttp.patch('*/api/spaces/:id/photos/order', () =>
          HttpResponse.json({ message: 'La lista no es válida' }, { status: 400 }),
        ),
      )

      await userEvent.click(screen.getByRole('button', { name: 'Mover foto 2 a la izquierda' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('La lista no es válida')
      expect(sources()).toEqual(before)
    })

    it('si el servidor no puede borrar, lo avisa y la foto sigue ahí', async () => {
      await withThree()
      server.use(
        mswHttp.delete('*/api/spaces/:id/photos/:photoId', () =>
          HttpResponse.json({ message: 'No se pudo borrar' }, { status: 500 }),
        ),
      )

      await userEvent.click(screen.getByRole('button', { name: 'Eliminar foto 1' }))
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo borrar')
      expect(tiles()).toHaveLength(3)
    })
  })
})
