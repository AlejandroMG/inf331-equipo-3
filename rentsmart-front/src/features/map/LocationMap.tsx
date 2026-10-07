import 'leaflet/dist/leaflet.css'
import { Browser } from 'leaflet'
import { AttributionControl, Circle, MapContainer, TileLayer, ZoomControl } from 'react-leaflet'
import type { ApproximateLocation } from '../catalog/types'
import { POINT_ZOOM, TILE_ATTRIBUTION, TILE_MAX_ZOOM, TILE_URL } from './map-config'

/**
 * Mapa del detalle público: un círculo con la zona aproximada del espacio, no un punto (ES-07).
 * Se carga con `LazyMaps`, para que Leaflet no pese en el resto de la aplicación.
 */
export default function LocationMap({ location }: { location: ApproximateLocation }) {
  const center: [number, number] = [location.latitude, location.longitude]
  return (
    <MapContainer
      center={center}
      zoom={POINT_ZOOM}
      // La rueda del mouse sigue desplazando la página, y en el teléfono el dedo también: el mapa no atrapa el scroll.
      scrollWheelZoom={false}
      dragging={!Browser.mobile}
      zoomControl={false}
      attributionControl={false}
      className="h-64 w-full rounded-xl border border-line sm:h-80"
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={TILE_MAX_ZOOM} />
      {/* className solo se aplica al crear el elemento: va como propiedad y no dentro de pathOptions. */}
      <Circle center={center} radius={location.radiusMeters} interactive={false} className="location-area" />
      <ZoomControl zoomInTitle="Acercar" zoomOutTitle="Alejar" />
      <AttributionControl prefix={false} />
    </MapContainer>
  )
}
