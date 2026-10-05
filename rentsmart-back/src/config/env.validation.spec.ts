import { validate } from './env.validation';

const VALID_URL = 'postgresql://user:pass@localhost:5432/db';

describe('validate', () => {
  it('acepta una configuración válida', () => {
    expect(() => validate({ DATABASE_URL: VALID_URL })).not.toThrow();
  });

  it('lanza error si falta DATABASE_URL', () => {
    expect(() => validate({})).toThrow();
  });

  it('lanza error si PORT no es un número', () => {
    expect(() => validate({ DATABASE_URL: VALID_URL, PORT: 'abc' })).toThrow();
  });

  it('convierte PORT de texto a número', () => {
    const result = validate({ DATABASE_URL: VALID_URL, PORT: '3000' });

    expect(result.PORT).toBe(3000);
  });

  describe('almacenamiento de fotos', () => {
    const base = { DATABASE_URL: VALID_URL };

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
