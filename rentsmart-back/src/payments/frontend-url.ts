import { ConfigService } from '@nestjs/config';

/** El mismo origen por defecto que CORS en `app.setup.ts`: el front de Vite en local. */
export const DEFAULT_FRONTEND_URL = 'http://localhost:5173';

/** La página de una reserva en el front (`/bookings/<id>`), a partir de `FRONTEND_URL` y sin barras de más. */
export function bookingPageUrl(config: ConfigService, bookingId: string): string {
  const frontend = (config.get<string>('FRONTEND_URL') ?? DEFAULT_FRONTEND_URL).replace(/\/+$/, '');
  return `${frontend}/bookings/${encodeURIComponent(bookingId)}`;
}
