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
});
