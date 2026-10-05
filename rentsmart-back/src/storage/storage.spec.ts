import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorageService } from './local-storage.service';
import { SupabaseStorageService } from './supabase-storage.service';

describe('LocalStorageService', () => {
  let dir: string;
  const env = process.env.UPLOADS_DIR;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'rentsmart-storage-'));
    process.env.UPLOADS_DIR = dir;
  });

  afterEach(async () => {
    process.env.UPLOADS_DIR = env;
    await rm(dir, { recursive: true, force: true });
  });

  it('guarda el archivo, creando las carpetas, y devuelve su dirección pública', async () => {
    const storage = new LocalStorageService();

    const stored = await storage.upload('spaces/s1/a.png', Buffer.from('hola'));

    expect(stored).toEqual({
      path: 'spaces/s1/a.png',
      url: '/api/uploads/spaces/s1/a.png',
    });
    expect(await readFile(join(dir, 'spaces/s1/a.png'), 'utf8')).toBe('hola');
  });

  it('borra el archivo y no falla si ya no existe', async () => {
    const storage = new LocalStorageService();
    await storage.upload('spaces/s1/a.png', Buffer.from('hola'));

    await storage.remove('spaces/s1/a.png');
    expect(existsSync(join(dir, 'spaces/s1/a.png'))).toBe(false);

    await expect(storage.remove('spaces/s1/a.png')).resolves.toBeUndefined();
  });

  it.each(['../fuera.png', 'spaces/../../fuera.png'])(
    'no deja guardar fuera de la carpeta de fotos (%s)',
    async (path) => {
      const storage = new LocalStorageService();

      await expect(storage.upload(path, Buffer.from('x'))).rejects.toThrow(
        'Ruta de archivo no válida',
      );
    },
  );
});

describe('SupabaseStorageService', () => {
  const config = {
    url: 'https://proyecto.supabase.co',
    serviceRoleKey: 'clave-de-servicio',
    bucket: 'space-photos',
  };
  const response = (status: number) => ({ ok: status < 400, status }) as Response;

  it('sube el archivo con la clave de servicio y devuelve su dirección pública', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200));
    const storage = new SupabaseStorageService(config, fetchImpl);

    const stored = await storage.upload(
      'spaces/s 1/a.png',
      Buffer.from('hola'),
      'image/png',
    );

    expect(stored).toEqual({
      path: 'spaces/s 1/a.png',
      url: 'https://proyecto.supabase.co/storage/v1/object/public/space-photos/spaces/s%201/a.png',
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://proyecto.supabase.co/storage/v1/object/space-photos/spaces/s%201/a.png',
    );
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer clave-de-servicio',
      apikey: 'clave-de-servicio',
      'Content-Type': 'image/png',
      'x-upsert': 'false',
    });
  });

  it('falla si Supabase rechaza la subida', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(403));
    const storage = new SupabaseStorageService(config, fetchImpl);

    await expect(
      storage.upload('spaces/s1/a.png', Buffer.from('x'), 'image/png'),
    ).rejects.toThrow('(403)');
  });

  it('borra el archivo y tolera que ya no exista', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(response(200))
      .mockResolvedValueOnce(response(404));
    const storage = new SupabaseStorageService(config, fetchImpl);

    await storage.remove('spaces/s1/a.png');
    await expect(storage.remove('spaces/s1/b.png')).resolves.toBeUndefined();

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://proyecto.supabase.co/storage/v1/object/space-photos/spaces/s1/a.png',
    );
    expect(init.method).toBe('DELETE');
  });

  it('falla si el borrado da un error distinto de "no existe"', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(500));
    const storage = new SupabaseStorageService(config, fetchImpl);

    await expect(storage.remove('spaces/s1/a.png')).rejects.toThrow('(500)');
  });
});
