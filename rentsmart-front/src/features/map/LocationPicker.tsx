import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { AttributionControl, CircleMarker, MapContainer, TileLayer, useMap, useMapEvents, ZoomControl } from 'react-leaflet'
import { DEFAULT_CENTER, DEFAULT_ZOOM, POINT_ZOOM, TILE_ATTRIBUTION, TILE_MAX_ZOOM, TILE_URL } from './map-config'

export interface Point {
  latitude: number
  longitude: number
}

/** 6 decimales son ~0,1 m: de sobra para un punto, y es lo que acepta el back. */
const round = (value: number) => Number(value.toFixed(6))

/** Un clic en el mapa marca el punto. */
function PickOnClick({ onPick }: { onPick: (point: Point) => void }) {
  useMapEvents({
    click: (event) => onPick({ latitude: round(event.latlng.lat), longitude: round(event.latlng.lng) }),
  })
  return null
}

/** Si el punto (por ejemplo, escrito a mano) queda fuera de lo que se ve, el mapa va hacia él. */
function ShowPoint({ point }: { point: Point | null }) {
  const map = useMap()
  useEffect(() => {
    if (point && !map.getBounds().contains([point.latitude, point.longitude])) {
      map.setView([point.latitude, point.longitude], Math.max(map.getZoom(), POINT_ZOOM))
    }
  }, [map, point])
  return null
}

/**
 * Mapa del formulario de publicar: el propietario toca dónde está su espacio. Es opcional y es una ayuda:
 * los mismos valores se pueden escribir en los campos de latitud y longitud (que también sirven con teclado).
 * Se carga con `LazyMaps`, para que Leaflet no pese en el resto de la aplicación.
 */
export default function LocationPicker({ point, onPick }: { point: Point | null; onPick: (point: Point) => void }) {
  const center: [number, number] = point ? [point.latitude, point.longitude] : DEFAULT_CENTER
  return (
    <MapContainer
      center={center}
      zoom={point ? POINT_ZOOM : DEFAULT_ZOOM}
      scrollWheelZoom={false}
      zoomControl={false}
      attributionControl={false}
      className="h-64 w-full cursor-crosshair rounded-xl border border-line sm:h-80"
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={TILE_MAX_ZOOM} />
      <PickOnClick onPick={onPick} />
      <ShowPoint point={point} />
      {point && <CircleMarker center={[point.latitude, point.longitude]} radius={9} interactive={false} className="location-pin" />}
      <ZoomControl zoomInTitle="Acercar" zoomOutTitle="Alejar" />
      <AttributionControl prefix={false} />
    </MapContainer>
  )
}
