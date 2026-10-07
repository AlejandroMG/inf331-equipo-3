import { CatalogLocationDto } from './dto/catalog-detail.dto';

/** Radio, en metros, del círculo que se muestra en el detalle público. */
export const APPROXIMATE_RADIUS_METERS = 150;

/**
 * Con 3 decimales las coordenadas quedan en una grilla de ~110 m, y el punto real queda siempre a menos de
 * 80 m del redondeado (en Chile). Por eso el círculo de 150 m centrado en el punto redondeado lo contiene.
 */
const DECIMALS = 3;

const round = (value: number) => Number(value.toFixed(DECIMALS));

/**
 * Ubicación que se muestra al público (ES-07): el punto exacto que marcó el propietario nunca sale de la API,
 * solo el redondeado con su radio. Sin punto marcado devuelve `null`.
 */
export function approximateLocation(
  latitude: number | null,
  longitude: number | null,
): CatalogLocationDto | null {
  if (latitude == null || longitude == null) return null;
  return {
    latitude: round(latitude),
    longitude: round(longitude),
    radiusMeters: APPROXIMATE_RADIUS_METERS,
  };
}
