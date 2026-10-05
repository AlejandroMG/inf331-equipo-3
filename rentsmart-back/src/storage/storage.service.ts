import { resolve } from 'node:path';

/** Un archivo ya guardado: su ruta dentro del almacenamiento y la dirección pública para mostrarlo. */
export interface StoredFile {
  path: string;
  url: string;
}

/**
 * Almacenamiento de archivos (fotos de los espacios). Tiene dos implementaciones: disco local para
 * desarrollo y tests, y Supabase Storage (P-10). Se elige con STORAGE_DRIVER.
 */
export abstract class StorageService {
  abstract upload(
    path: string,
    data: Buffer,
    contentType: string,
  ): Promise<StoredFile>;

  /** Borra un archivo. Si ya no existe no es un error. */
  abstract remove(path: string): Promise<void>;
}

/** Carpeta donde el almacenamiento local guarda y desde donde se sirven las fotos. */
export function uploadsDir(): string {
  return resolve(process.env.UPLOADS_DIR ?? 'uploads');
}

/** Prefijo público de las fotos servidas por el almacenamiento local. */
export const UPLOADS_PREFIX = '/api/uploads';
