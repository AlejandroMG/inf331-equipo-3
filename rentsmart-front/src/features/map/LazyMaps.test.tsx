import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CENTER } from './map-config'
import { LazyLocationMap, LazyLocationPicker } from './LazyMaps'

// Estos tests usan Leaflet de verdad (en jsdom): comprueban que los mapas montan, con sus controles en español, su
// atribución y su círculo o pin. No se carga ninguna tesela: jsdom no descarga imágenes.
const location = { latitude: -33.449, longitude: -70.669, radiusMeters: 150 }

// jsdom no sabe dibujar SVG, y sin SVG Leaflet no crea ni círculos ni pines. Basta con que el navegador "diga" que puede:
// Leaflet lo comprueba al cargarse, que aquí ocurre en el primer render (los mapas se cargan bajo demanda).
beforeAll(() => {
  Object.defineProperty(SVGSVGElement.prototype, 'createSVGRect', { value: () => ({}), configurable: true })
})

describe('LazyLocationMap', () => {
  it('muestra "Cargando mapa…" mientras llega Leaflet y luego el mapa', async () => {
    render(<LazyLocationMap location={location} label="Mapa de Sala Alameda" />)

    expect(screen.getByRole('status')).toHaveTextContent('Cargando mapa…')

    const region = await screen.findByRole('region', { name: 'Mapa de Sala Alameda' })
    expect(await within(region).findByRole('button', { name: 'Acercar' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('tiene los controles de zoom en español y la atribución de OpenStreetMap', async () => {
    render(<LazyLocationMap location={location} label="Mapa de Sala Alameda" />)

    const region = await screen.findByRole('region', { name: 'Mapa de Sala Alameda' })
    expect(await within(region).findByRole('button', { name: 'Alejar' })).toBeInTheDocument()
    expect(within(region).getByRole('link', { name: 'OpenStreetMap' })).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright')
  })

  it('dibuja la zona aproximada como un círculo, no como un punto, y no es interactiva', async () => {
    const { container } = render(<LazyLocationMap location={location} label="Mapa de Sala Alameda" />)
    await screen.findByRole('button', { name: 'Acercar' })

    const area = container.querySelector('path.location-area')
    expect(area).not.toBeNull()
    expect(area).not.toHaveClass('leaflet-interactive')
    expect(container.querySelector('.location-pin')).toBeNull()
  })
})

describe('LazyLocationPicker', () => {
  it('sin punto no dibuja el pin', async () => {
    const { container } = render(<LazyLocationPicker point={null} onPick={vi.fn()} label="Mapa para marcar" />)
    await screen.findByRole('button', { name: 'Acercar' })

    expect(container.querySelector('.location-pin')).toBeNull()
  })

  it('con un punto dibuja el pin', async () => {
    const { container } = render(<LazyLocationPicker point={{ latitude: -33.4, longitude: -70.6 }} onPick={vi.fn()} label="Mapa para marcar" />)
    await screen.findByRole('button', { name: 'Acercar' })

    expect(container.querySelector('path.location-pin')).not.toBeNull()
  })

  it('un clic en el mapa entrega el punto, con hasta 6 decimales', async () => {
    const onPick = vi.fn()
    const { container } = render(<LazyLocationPicker point={null} onPick={onPick} label="Mapa para marcar" />)
    await screen.findByRole('button', { name: 'Acercar' })

    // jsdom no tiene tamaño de pantalla: el centro del mapa y el punto donde se hace clic coinciden.
    fireEvent.click(container.querySelector('.leaflet-container')!, { clientX: 0, clientY: 0 })

    expect(onPick).toHaveBeenCalledTimes(1)
    const [point] = onPick.mock.calls[0] as [{ latitude: number; longitude: number }]
    expect(point.latitude).toBeCloseTo(DEFAULT_CENTER[0], 3)
    expect(point.longitude).toBeCloseTo(DEFAULT_CENTER[1], 3)
    expect(String(point.latitude).split('.')[1].length).toBeLessThanOrEqual(6)
  })
})
