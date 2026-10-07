import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LazyLocationMap, LazyLocationPicker } from './LazyMaps'

// Un mapa que no carga (sin red, o una página vieja que pide un archivo que ya no existe) no debe romper la pantalla.
vi.mock('./LocationMap', () => {
  throw new Error('No se pudo descargar el mapa')
})
vi.mock('./LocationPicker', () => {
  throw new Error('No se pudo descargar el mapa')
})

describe('mapa que no carga', () => {
  afterEach(() => vi.restoreAllMocks())

  it('el detalle muestra un aviso en lugar del mapa', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <>
        <h2>Ubicación</h2>
        <LazyLocationMap location={{ latitude: -33.4, longitude: -70.6, radiusMeters: 150 }} label="Mapa de Sala Alameda" />
      </>,
    )

    expect(await screen.findByText('No pudimos cargar el mapa. Intenta recargar la página.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ubicación' })).toBeInTheDocument()
  })

  it('el formulario también, y los campos de latitud y longitud siguen disponibles aparte', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<LazyLocationPicker point={null} onPick={vi.fn()} label="Mapa para marcar" />)

    expect(await screen.findByText('No pudimos cargar el mapa. Intenta recargar la página.')).toBeInTheDocument()
  })
})
