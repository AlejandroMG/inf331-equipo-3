import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { LazyLocationPicker } from '../map/LazyMaps'
import type { Point } from '../map/LocationPicker'
import { APPROXIMATE_RADIUS_METERS } from '../map/map-config'
import type { FormErrors } from './form'

interface LocationFieldProps {
  latitude: string
  longitude: string
  errors: FormErrors
  onChange: (field: 'latitude' | 'longitude', value: string) => void
}

/** El punto del mapa, si las dos coordenadas escritas son números; null en cualquier otro caso. */
function toPoint(latitude: string, longitude: string): Point | null {
  if (latitude.trim() === '' || longitude.trim() === '') return null
  const point = { latitude: Number(latitude), longitude: Number(longitude) }
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude) ? point : null
}

/**
 * Ubicación del espacio en el mapa (ES-07), opcional: se marca con un clic en el mapa o escribiendo la latitud y la
 * longitud, que además es la forma de hacerlo con teclado. El detalle público muestra solo una zona aproximada.
 */
export function LocationField({ latitude, longitude, errors, onChange }: LocationFieldProps) {
  const point = toPoint(latitude, longitude)

  function pick({ latitude: lat, longitude: lng }: Point) {
    onChange('latitude', String(lat))
    onChange('longitude', String(lng))
  }

  function clear() {
    onChange('latitude', '')
    onChange('longitude', '')
  }

  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <legend className="mb-1.5 p-0 text-[15px] font-semibold">Ubicación en el mapa (opcional)</legend>
      <p className="text-[13px] text-muted">
        Toca el mapa donde está tu espacio. En el catálogo se muestra solo una zona aproximada (un círculo de unos {APPROXIMATE_RADIUS_METERS} m),
        no el punto exacto.
      </p>
      <LazyLocationPicker point={point} onPick={pick} label="Mapa para marcar la ubicación del espacio" />
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-48 flex-1">
          <Input
            label="Latitud"
            type="number"
            step="any"
            inputMode="decimal"
            value={latitude}
            onChange={(e) => onChange('latitude', e.target.value)}
            error={errors.latitude}
            placeholder="-33.4489"
          />
        </div>
        <div className="min-w-48 flex-1">
          <Input
            label="Longitud"
            type="number"
            step="any"
            inputMode="decimal"
            value={longitude}
            onChange={(e) => onChange('longitude', e.target.value)}
            error={errors.longitude}
            placeholder="-70.6693"
          />
        </div>
      </div>
      {(latitude !== '' || longitude !== '') && (
        <div>
          <Button variant="secondary" size="sm" onClick={clear}>
            Quitar el punto
          </Button>
        </div>
      )}
    </fieldset>
  )
}
