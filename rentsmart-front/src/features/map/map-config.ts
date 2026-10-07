/**
 * Mapas (ES-07): Leaflet con las teselas de OpenStreetMap. Las teselas públicas de OSM son gratis pero tienen una
 * política de uso razonable (https://operations.osmfoundation.org/policies/tiles/): sirven para el MVP; con tráfico
 * real hay que cambiar `TILE_URL` por un proveedor propio.
 */
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
export const TILE_MAX_ZOOM = 19

/** Santiago: el mapa del formulario parte aquí mientras el propietario no marca un punto. */
export const DEFAULT_CENTER: [number, number] = [-33.4489, -70.6693]
export const DEFAULT_ZOOM = 11
/** Zoom al mostrar un punto: se ve el barrio alrededor, y el círculo de ~150 m es visible. */
export const POINT_ZOOM = 15

/** Caja que contiene a Chile; es la misma que valida el back. Descarta los puntos que no pueden ser de aquí. */
export const CHILE_BOUNDS = { minLat: -56, maxLat: -17, minLng: -110, maxLng: -66 } as const

/** Radio, en metros, de la zona aproximada que muestra el detalle público (lo decide el back). */
export const APPROXIMATE_RADIUS_METERS = 150
