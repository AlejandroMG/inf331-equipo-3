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

  describe('almacenamiento de fotos', () => {
    const base = BASE;

    it('por defecto no exige nada de Supabase', () => {
      expect(() => validate(base)).not.toThrow();
      expect(() => validate({ ...base, STORAGE_DRIVER: 'local' })).not.toThrow();
    });

    it('solo acepta los drivers local y supabase', () => {
      expect(() => validate({ ...base, STORAGE_DRIVER: 's3' })).toThrow('STORAGE_DRIVER');
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
});
