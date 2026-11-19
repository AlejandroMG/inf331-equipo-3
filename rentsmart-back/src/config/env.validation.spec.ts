import { validate } from './env.validation';

const VALID_URL = 'postgresql://user:pass@localhost:5432/db';
const SECRET = 'x'.repeat(32);
const BASE = { DATABASE_URL: VALID_URL, JWT_SECRET: SECRET };

describe('validate', () => {
  it('acepta una configuración válida', () => {
    expect(() => validate(BASE)).not.toThrow();
  });

  it('lanza error si falta DATABASE_URL', () => {
    expect(() => validate({ JWT_SECRET: SECRET })).toThrow();
  });

  it('lanza error si PORT no es un número', () => {
    expect(() => validate({ ...BASE, PORT: 'abc' })).toThrow();
  });

  it('convierte PORT de texto a número', () => {
    const result = validate({ ...BASE, PORT: '3000' });

    expect(result.PORT).toBe(3000);
  });

  it('lanza error si falta JWT_SECRET', () => {
    expect(() => validate({ DATABASE_URL: VALID_URL })).toThrow('JWT_SECRET');
  });

  it('exige un JWT_SECRET de al menos 32 caracteres (31 falla, 32 pasa)', () => {
    expect(() => validate({ ...BASE, JWT_SECRET: 'x'.repeat(31) })).toThrow(
      'JWT_SECRET',
    );
    expect(() =>
      validate({ ...BASE, JWT_SECRET: 'x'.repeat(32) }),
    ).not.toThrow();
  });

  it.each(['1d', '8h', '30m', '3600s'])(
    'acepta JWT_EXPIRES_IN = %s',
    (value) => {
      expect(() => validate({ ...BASE, JWT_EXPIRES_IN: value })).not.toThrow();
    },
  );

  it.each(['1 día', 'abc', '10'])('rechaza JWT_EXPIRES_IN = %s', (value) => {
    expect(() => validate({ ...BASE, JWT_EXPIRES_IN: value })).toThrow(
      'JWT_EXPIRES_IN',
    );
  });

  describe('vencimientos automáticos (RE-06)', () => {
    it.each(['true', 'false'])('acepta BOOKING_SWEEP_ENABLED = %s', (value) => {
      expect(() =>
        validate({ ...BASE, BOOKING_SWEEP_ENABLED: value }),
      ).not.toThrow();
    });

    it.each(['sí', '0', 'TRUE'])(
      'rechaza BOOKING_SWEEP_ENABLED = %s',
      (value) => {
        expect(() =>
          validate({ ...BASE, BOOKING_SWEEP_ENABLED: value }),
        ).toThrow('BOOKING_SWEEP_ENABLED');
      },
    );

    it('convierte BOOKING_SWEEP_INTERVAL_MS a número y exige al menos 1000 (999 falla)', () => {
      expect(
        validate({ ...BASE, BOOKING_SWEEP_INTERVAL_MS: '1000' })
          .BOOKING_SWEEP_INTERVAL_MS,
      ).toBe(1000);
      expect(() =>
        validate({ ...BASE, BOOKING_SWEEP_INTERVAL_MS: '999' }),
      ).toThrow('BOOKING_SWEEP_INTERVAL_MS');
      expect(() =>
        validate({ ...BASE, BOOKING_SWEEP_INTERVAL_MS: 'un minuto' }),
      ).toThrow('BOOKING_SWEEP_INTERVAL_MS');
    });

    it('acepta BOOKING_SWEEP_INTERVAL_MS hasta el máximo de setInterval (2147483647) y rechaza uno más', () => {
      expect(
        validate({ ...BASE, BOOKING_SWEEP_INTERVAL_MS: '2147483647' })
          .BOOKING_SWEEP_INTERVAL_MS,
      ).toBe(2_147_483_647);
      expect(() =>
        validate({ ...BASE, BOOKING_SWEEP_INTERVAL_MS: '2147483648' }),
      ).toThrow('BOOKING_SWEEP_INTERVAL_MS');
    });
  });

  describe('almacenamiento de fotos', () => {
    const base = BASE;

    it('por defecto no exige nada de Supabase', () => {
      expect(() => validate(base)).not.toThrow();
      expect(() =>
        validate({ ...base, STORAGE_DRIVER: 'local' }),
      ).not.toThrow();
    });

    it('solo acepta los drivers local y supabase', () => {
      expect(() => validate({ ...base, STORAGE_DRIVER: 's3' })).toThrow(
        'STORAGE_DRIVER',
      );
    });

    it('con supabase exige la URL, la clave de servicio y el bucket', () => {
      expect(() => validate({ ...base, STORAGE_DRIVER: 'supabase' })).toThrow(
        /SUPABASE_URL.*SUPABASE_SERVICE_ROLE_KEY.*SUPABASE_BUCKET/,
      );
      expect(() =>
        validate({
          ...base,
          STORAGE_DRIVER: 'supabase',
          SUPABASE_URL: 'https://proyecto.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: 'clave',
          SUPABASE_BUCKET: 'space-photos',
        }),
      ).not.toThrow();
    });
  });

  // Valores inventados: no son claves reales.
  describe('Stripe (PA-01)', () => {
    it('las dos variables son opcionales, también vacías', () => {
      expect(() => validate(BASE)).not.toThrow();
      expect(() =>
        validate({ ...BASE, STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '' }),
      ).not.toThrow();
    });

    it.each(['sk_test_abc123', 'rk_test_abc123'])(
      'acepta la clave de test %s',
      (key) => {
        expect(
          validate({ ...BASE, STRIPE_SECRET_KEY: key }).STRIPE_SECRET_KEY,
        ).toBe(key);
      },
    );

    it.each(['sk_live_abc123', 'pk_test_abc123', 'cualquier-cosa'])(
      'rechaza %s: solo claves secretas de modo test',
      (key) => {
        expect(() => validate({ ...BASE, STRIPE_SECRET_KEY: key })).toThrow(
          'STRIPE_SECRET_KEY',
        );
      },
    );

    it('el secreto del webhook debe empezar con whsec_', () => {
      expect(() =>
        validate({ ...BASE, STRIPE_WEBHOOK_SECRET: 'whsec_abc123' }),
      ).not.toThrow();
      expect(() =>
        validate({ ...BASE, STRIPE_WEBHOOK_SECRET: 'abc123' }),
      ).toThrow('STRIPE_WEBHOOK_SECRET');
    });
  });

  describe('IA-01', () => {
    it('usa el mock sin requerir credenciales externas', () => {
      expect(() => validate({ ...BASE, AI_PROVIDER: 'mock' })).not.toThrow();
    });

    it('exige una clave API al seleccionar Gemini', () => {
      expect(() => validate({ ...BASE, AI_PROVIDER: 'gemini' })).toThrow(
        'AI_API_KEY',
      );
      expect(() =>
        validate({
          ...BASE,
          AI_PROVIDER: 'gemini',
          AI_API_KEY: 'fake-key',
        }),
      ).not.toThrow();
    });

    it('solo acepta Gemini o el mock como proveedor', () => {
      expect(() => validate({ ...BASE, AI_PROVIDER: 'other' })).toThrow(
        'AI_PROVIDER',
      );
    });

    it('convierte y valida el timeout y la cuota', () => {
      const result = validate({
        ...BASE,
        AI_TIMEOUT_MS: '15000',
        AI_MAX_USES_PER_24H: '15',
      });
      expect(result.AI_TIMEOUT_MS).toBe(15_000);
      expect(result.AI_MAX_USES_PER_24H).toBe(15);

      expect(() => validate({ ...BASE, AI_TIMEOUT_MS: '999' })).toThrow(
        'AI_TIMEOUT_MS',
      );
      expect(() => validate({ ...BASE, AI_MAX_USES_PER_24H: '0' })).toThrow(
        'AI_MAX_USES_PER_24H',
      );
    });
  });
});
