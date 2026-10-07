import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import {
  StorageService,
  StoredFile,
  UPLOADS_PREFIX,
  uploadsDir,
} from './storage.service';

/** Guarda los archivos en disco. Solo para desarrollo y tests; en producción se usa Supabase. */
export class LocalStorageService extends StorageService {
  private readonly root = uploadsDir();

  async upload(path: string, data: Buffer): Promise<StoredFile> {
    const file = this.locate(path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, data);
    return { path, url: `${UPLOADS_PREFIX}/${path}` };
  }

  async remove(path: string): Promise<void> {
    await rm(this.locate(path), { force: true });
  }

  /** Ruta en disco de un archivo; rechaza las que se salgan de la carpeta de fotos. */
  private locate(path: string): string {
    const file = resolve(join(this.root, path));
    if (!file.startsWith(this.root + sep)) {
      throw new Error('Ruta de archivo no válida');
    }
    return file;
  }
}
