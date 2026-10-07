import { CHILE_BOUNDS } from '../spaces/dto/create-space.dto';
import {
  APPROXIMATE_RADIUS_METERS,
  approximateLocation,
} from './approximate-location';

/** Distancia en metros entre dos puntos (fórmula del haversine). */
function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) *
      Math.cos(rad(lat2)) *
      Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(a));
}

describe('approximateLocation', () => {
  it('redondea a 3 decimales y agrega el radio', () => {
    expect(approximateLocation(-33.44891, -70.66927)).toEqual({
      latitude: -33.449,
      longitude: -70.669,
      radiusMeters: APPROXIMATE_RADIUS_METERS,
    });
  });

  it('sin latitud o sin longitud no hay ubicación', () => {
    expect(approximateLocation(null, null)).toBeNull();
    expect(approximateLocation(-33.4, null)).toBeNull();
    expect(approximateLocation(null, -70.6)).toBeNull();
  });

  it('el punto exacto siempre queda dentro del círculo, en cualquier lugar de Chile', () => {
    // Recorre Chile en una grilla irregular, incluidos los bordes de las celdas del redondeo.
    for (let lat = CHILE_BOUNDS.minLat; lat <= CHILE_BOUNDS.maxLat; lat += 0.3737) {
      for (let lng = CHILE_BOUNDS.minLng; lng <= CHILE_BOUNDS.maxLng; lng += 0.4141) {
        const shown = approximateLocation(lat, lng);
        expect(shown).not.toBeNull();
        const away = distanceMeters(lat, lng, shown!.latitude, shown!.longitude);
        expect(away).toBeLessThan(shown!.radiusMeters);
      }
    }
  });

  it('en el peor caso (borde de la celda, cerca del norte) queda a menos de 80 m', () => {
    const lat = -17.0004999;
    const lng = -66.0004999;
    const shown = approximateLocation(lat, lng)!;

    expect(distanceMeters(lat, lng, shown.latitude, shown.longitude)).toBeLessThan(80);
  });

  it('dos puntos de la misma celda muestran lo mismo, así no se puede afinar el punto', () => {
    expect(approximateLocation(-33.4491, -70.6693)).toEqual(
      approximateLocation(-33.4494, -70.6689),
    );
  });
});
