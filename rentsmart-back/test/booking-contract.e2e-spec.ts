import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer } from './utils/auth';
import { createTestApp } from './utils/create-test-app';

// F-05: el contrato de disponibilidad, reservas y pagos. Comprueba la forma (Swagger, 400 y 401), no la lógica:
// cada historia (DI-02, RE-02, PA-01, PA-02) reemplaza su 501 por sus propios tests. El horario semanal (DI-01) ya
// está implementado: sus e2e están en schedule.e2e-spec.ts.
const SUFFIX = `e2e-f05-${Date.now()}`;
const SPACE = 'un-espacio';
const BOOKING = 'una-reserva';

const VALID_BOOKING = {
  spaceId: SPACE,
  startAt: '2026-10-12T12:00:00.000Z',
  endAt: '2026-10-12T14:00:00.000Z',
  unit: 'HOUR',
};

interface SwaggerDoc {
  paths: Record<string, Record<string, { responses: Record<string, unknown>; security?: unknown[] }>>;
  components: { schemas: Record<string, { properties: Record<string, unknown>; required?: string[] }> };
}

describe('Contrato de disponibilidad, reservas y pagos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userId: string;

  const server = () => app.getHttpServer();
  const auth = () => bearer(app, userId);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const user = await prisma.user.create({
      data: { email: `user-${SUFFIX}@rentsmart.test`, passwordHash: 'no-es-un-hash-real', name: 'Contrato' },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  describe('Swagger', () => {
    let doc: SwaggerDoc;

    beforeAll(async () => {
      doc = (await request(server()).get('/docs-json').expect(200)).body as SwaggerDoc;
    });

    it.each([
      ['get', '/api/spaces/{id}/availability', ['200', '400', '404']],
      ['get', '/api/spaces/{id}/schedule', ['200', '401', '403', '404']],
      ['put', '/api/spaces/{id}/schedule', ['200', '400', '401', '403', '404', '409']],
      ['post', '/api/bookings', ['201', '400', '401', '404', '409']],
      ['get', '/api/bookings/me', ['200', '400', '401']],
      ['get', '/api/bookings/{id}', ['200', '401', '403', '404']],
      ['post', '/api/bookings/{id}/cancel', ['200', '401', '403', '404', '409']],
      ['post', '/api/payments/webhook', ['200', '400']],
      ['get', '/api/payments/me', ['200', '400', '401']],
    ])('documenta %s %s con sus respuestas', (method, path, codes) => {
      const operation = doc.paths[path]?.[method];

      expect(operation).toBeDefined();
      expect(Object.keys(operation.responses)).toEqual(expect.arrayContaining(codes));
    });

    it('marca con sesión los endpoints privados y sin sesión los públicos', () => {
      expect(doc.paths['/api/bookings'].post.security).toBeDefined();
      expect(doc.paths['/api/spaces/{id}/schedule'].put.security).toBeDefined();
      expect(doc.paths['/api/payments/me'].get.security).toBeDefined();
      expect(doc.paths['/api/spaces/{id}/availability'].get.security).toBeUndefined();
      expect(doc.paths['/api/payments/webhook'].post.security).toBeUndefined();
    });

    it('describe los DTOs con los campos del contrato', () => {
      const fields = (name: string) => Object.keys(doc.components.schemas[name].properties).sort();

      expect(fields('CreateBookingDto')).toEqual(['endAt', 'spaceId', 'startAt', 'unit']);
      expect(fields('BookingCheckoutDto')).toEqual(['bookingId', 'checkoutUrl']);
      expect(fields('BookingDto')).toEqual([
        'createdAt', 'endAt', 'expiresAt', 'fee', 'id', 'space', 'startAt', 'status', 'subtotal', 'total', 'unit',
      ]);
      expect(fields('BookingSpaceDto')).toEqual(['address', 'addressDetail', 'communeName', 'coverUrl', 'id', 'name']);
      expect(fields('BookingsPageDto')).toEqual(['items', 'page', 'pageSize', 'total']);
      expect(fields('AvailabilityDto')).toEqual(['days', 'spaceId', 'timeZone']);
      expect(fields('AvailabilityDayDto')).toEqual(['date', 'fullDay', 'slots']);
      expect(fields('ScheduleRuleDto')).toEqual(['endTime', 'startTime', 'weekday']);
      expect(fields('PaymentDto')).toEqual([
        'amount', 'bookingId', 'createdAt', 'fee', 'id', 'refundedAmount', 'spaceName', 'status',
      ]);
    });

    it('los estados de la reserva son los seis del ciclo de vida', () => {
      const status = doc.components.schemas.BookingDto.properties.status as { enum: string[] };

      expect(status.enum).toEqual(['PENDING', 'PAID', 'CONFIRMED', 'FINISHED', 'CANCELLED', 'EXPIRED']);
    });
  });

  describe('sin sesión', () => {
    it.each([
      ['get', `/api/spaces/${SPACE}/schedule`],
      ['put', `/api/spaces/${SPACE}/schedule`],
      ['post', '/api/bookings'],
      ['get', '/api/bookings/me'],
      ['get', `/api/bookings/${BOOKING}`],
      ['post', `/api/bookings/${BOOKING}/cancel`],
      ['get', '/api/payments/me'],
    ] as const)('%s %s responde 401', async (method, path) => {
      await request(server())[method](path).expect(401);
      await request(server())[method](path).set('Authorization', 'Bearer no-es-un-token').expect(401);
    });

    it('la disponibilidad es pública: no pide sesión', async () => {
      const { status } = await request(server()).get(`/api/spaces/${SPACE}/availability?from=2026-10-12&to=2026-10-18`);

      expect(status).not.toBe(401);
    });

    it('el webhook no pide sesión, pero sin la firma de Stripe responde 400', async () => {
      await request(server()).post('/api/payments/webhook').send({ type: 'checkout.session.completed' }).expect(400);
    });
  });

  describe('datos inválidos', () => {
    it.each([
      ['sin fechas', ''],
      ['sin la fecha final', '?from=2026-10-12'],
      ['con una fecha con hora', '?from=2026-10-12T00:00:00Z&to=2026-10-18'],
      ['con un mes que no existe', '?from=2026-13-01&to=2026-13-02'],
      ['con un parámetro desconocido', '?from=2026-10-12&to=2026-10-18&otro=1'],
    ])('GET availability %s responde 400', (_name, query) => {
      return request(server()).get(`/api/spaces/${SPACE}/availability${query}`).expect(400);
    });

    it.each([
      ['sin rules', {}],
      ['con rules que no es una lista', { rules: 'lunes' }],
      ['con un día fuera de 0 a 6', { rules: [{ weekday: 7, startTime: '09:00', endTime: '10:00' }] }],
      ['con una hora que no es cerrada', { rules: [{ weekday: 1, startTime: '09:30', endTime: '10:00' }] }],
      ['con un fin que no es una hora', { rules: [{ weekday: 1, startTime: '09:00', endTime: '25:00' }] }],
      ['con un campo desconocido', { rules: [], otro: 1 }],
    ])('PUT schedule %s responde 400', (_name, body) => {
      return request(server()).put(`/api/spaces/${SPACE}/schedule`).set(auth()).send(body).expect(400);
    });

    it.each([
      ['sin datos', {}],
      ['sin el espacio', { ...VALID_BOOKING, spaceId: undefined }],
      ['con un inicio que no es una hora cerrada', { ...VALID_BOOKING, startAt: '2026-10-12T12:30:00.000Z' }],
      ['con un fin que no está en UTC', { ...VALID_BOOKING, endAt: '2026-10-12T11:00:00-03:00' }],
      ['con un día que no existe', { ...VALID_BOOKING, startAt: '2026-02-31T12:00:00.000Z' }],
      ['con una unidad desconocida', { ...VALID_BOOKING, unit: 'WEEK' }],
      ['con el precio puesto por el cliente', { ...VALID_BOOKING, total: 1 }],
    ])('POST bookings %s responde 400', (_name, body) => {
      return request(server()).post('/api/bookings').set(auth()).send(body).expect(400);
    });

    it.each([
      ['/api/bookings/me?page=0'],
      ['/api/bookings/me?pageSize=51'],
      ['/api/bookings/me?otro=1'],
      ['/api/payments/me?page=0'],
      ['/api/payments/me?pageSize=abc'],
    ])('GET %s responde 400', (path) => {
      return request(server()).get(path).set(auth()).expect(400);
    });
  });

  // Los datos válidos del contrato pasan la validación y llegan al servicio, que todavía no existe (501).
  // Cada historia cambia su línea por tests de verdad.
  describe('pendiente de implementar', () => {
    it.each([
      ['get', `/api/spaces/${SPACE}/availability?from=2026-10-12&to=2026-10-18`, undefined],
      ['post', '/api/bookings', VALID_BOOKING],
      ['post', '/api/bookings', { ...VALID_BOOKING, startAt: '2026-10-12T12:00:00Z', unit: 'DAY' }],
      ['get', '/api/bookings/me', undefined],
      ['get', '/api/bookings/me?page=2&pageSize=50', undefined],
      ['get', `/api/bookings/${BOOKING}`, undefined],
      ['post', `/api/bookings/${BOOKING}/cancel`, undefined],
      ['get', '/api/payments/me?page=1&pageSize=10', undefined],
    ] as const)('%s %s responde 501 con datos válidos', (method, path, body) => {
      return request(server())[method](path).set(auth()).send(body).expect(501);
    });

    it('el webhook con firma llega al servicio (501)', () => {
      return request(server())
        .post('/api/payments/webhook')
        .set('stripe-signature', 't=1,v1=firma')
        .send({ id: 'evt_1', type: 'checkout.session.completed' })
        .expect(501);
    });
  });
});
