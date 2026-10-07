import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { LocationField } from './LocationField'
import type { FormErrors } from './form'

// El mapa de verdad (Leaflet) se prueba en LazyMaps.test.tsx; aquí se simula con un botón que "marca" un punto.
vi.mock('../map/LazyMaps', () => ({
  LazyLocationPicker: ({
    point,
    onPick,
  }: {
    point: { latitude: number; longitude: number } | null
    onPick: (point: { latitude: number; longitude: number }) => void
  }) => (
    <div>
      <p>{point ? `Punto en el mapa: ${point.latitude}, ${point.longitude}` : 'Sin punto en el mapa'}</p>
      <button type="button" onClick={() => onPick({ latitude: -33.5, longitude: -70.6 })}>
        Marcar en el mapa
      </button>
    </div>
  ),
}))

function Harness({ initial = ['', ''], errors = {} }: { initial?: [string, string]; errors?: FormErrors }) {
  const [latitude, setLatitude] = useState(initial[0])
  const [longitude, setLongitude] = useState(initial[1])
  return (
    <LocationField
      latitude={latitude}
      longitude={longitude}
      errors={errors}
      onChange={(field, value) => (field === 'latitude' ? setLatitude : setLongitude)(value)}
    />
  )
}

describe('LocationField', () => {
  it('explica que en el catálogo solo se muestra una zona aproximada', () => {
    render(<Harness />)

    expect(screen.getByRole('group', { name: 'Ubicación en el mapa (opcional)' })).toBeInTheDocument()
    expect(screen.getByText(/un círculo de unos 150 m/)).toBeInTheDocument()
  })

  it('un clic en el mapa llena la latitud y la longitud', async () => {
    render(<Harness />)

    await userEvent.click(screen.getByRole('button', { name: 'Marcar en el mapa' }))

    expect(screen.getByLabelText('Latitud')).toHaveValue(-33.5)
    expect(screen.getByLabelText('Longitud')).toHaveValue(-70.6)
  })

  it('escribir las coordenadas mueve el punto del mapa, con teclado y sin tocar el mapa', async () => {
    render(<Harness />)
    expect(screen.getByText('Sin punto en el mapa')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Latitud'), '-33.4489')
    expect(screen.getByText('Sin punto en el mapa')).toBeInTheDocument() // falta la longitud
    await userEvent.type(screen.getByLabelText('Longitud'), '-70.6693')

    expect(screen.getByText('Punto en el mapa: -33.4489, -70.6693')).toBeInTheDocument()
  })

  it('"Quitar el punto" vacía las dos coordenadas y desaparece', async () => {
    render(<Harness initial={['-33.4489', '-70.6693']} />)

    await userEvent.click(screen.getByRole('button', { name: 'Quitar el punto' }))

    expect(screen.getByLabelText('Latitud')).toHaveValue(null)
    expect(screen.getByLabelText('Longitud')).toHaveValue(null)
    expect(screen.getByText('Sin punto en el mapa')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Quitar el punto' })).not.toBeInTheDocument()
  })

  it('sin coordenadas no ofrece quitar el punto', () => {
    render(<Harness />)

    expect(screen.queryByRole('button', { name: 'Quitar el punto' })).not.toBeInTheDocument()
  })

  it('muestra los errores de cada campo y los marca como inválidos', () => {
    render(<Harness initial={['40', '']} errors={{ latitude: 'La latitud no vale.', longitude: 'Falta la longitud.' }} />)

    expect(screen.getByText('La latitud no vale.')).toBeInTheDocument()
    expect(screen.getByLabelText('Latitud')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Longitud')).toHaveAttribute('aria-invalid', 'true')
  })
})
