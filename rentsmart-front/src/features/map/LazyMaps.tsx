import { Component, lazy, Suspense, type ReactNode } from 'react'
import type { ApproximateLocation } from '../catalog/types'
import type { Point } from './LocationPicker'

// Leaflet pesa más de 40 kB: se descarga solo cuando una pantalla muestra un mapa.
const LocationMap = lazy(() => import('./LocationMap'))
const LocationPicker = lazy(() => import('./LocationPicker'))

const FRAME = 'flex h-64 items-center justify-center rounded-xl border border-line bg-surface px-4 text-center text-[15px] text-muted sm:h-80'

/** Si el mapa no carga (sin red, o una versión vieja de la página), el resto de la pantalla sigue funcionando. */
class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) return <p className={FRAME}>No pudimos cargar el mapa. Intenta recargar la página.</p>
    return this.props.children
  }
}

function MapFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={label}>
      <MapBoundary>
        <Suspense fallback={<p role="status" className={FRAME}>Cargando mapa…</p>}>{children}</Suspense>
      </MapBoundary>
    </div>
  )
}

/** Zona aproximada de un espacio, en el detalle público. */
export function LazyLocationMap({ location, label }: { location: ApproximateLocation; label: string }) {
  return (
    <MapFrame label={label}>
      <LocationMap location={location} />
    </MapFrame>
  )
}

/** Mapa donde el propietario marca el punto de su espacio. */
export function LazyLocationPicker({ point, onPick, label }: { point: Point | null; onPick: (point: Point) => void; label: string }) {
  return (
    <MapFrame label={label}>
      <LocationPicker point={point} onPick={onPick} />
    </MapFrame>
  )
}
