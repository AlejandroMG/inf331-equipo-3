import { StorageService, StoredFile } from './storage.service';

export interface SupabaseStorageConfig {
  url: string;
  serviceRoleKey: string;
  bucket: string;
}

/**
 * Guarda los archivos en un bucket público de Supabase Storage, con la API REST (sin dependencias).
 * La clave `service_role` solo vive en el servidor: nunca llega al navegador.
 */
export class SupabaseStorageService extends StorageService {
  constructor(
    private readonly config: SupabaseStorageConfig,
    private readonly fetchImpl: typeof fetch = (input, init) =>
      fetch(input, init),
  ) {
    super();
  }

  async upload(
    path: string,
    data: Buffer,
    contentType: string,
  ): Promise<StoredFile> {
    const response = await this.fetchImpl(this.objectUrl(path), {
      method: 'POST',
      headers: {
        ...this.auth(),
        'Content-Type': contentType,
        'x-upsert': 'false',
      },
      body: new Uint8Array(data),
    });
    if (!response.ok) {
      throw new Error(`Supabase Storage no guardó el archivo (${response.status})`);
    }
    const { url, bucket } = this.config;
    return {
      path,
      url: `${url}/storage/v1/object/public/${bucket}/${this.encode(path)}`,
    };
  }

  async remove(path: string): Promise<void> {
    const response = await this.fetchImpl(this.objectUrl(path), {
      method: 'DELETE',
      headers: this.auth(),
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Supabase Storage no borró el archivo (${response.status})`);
    }
  }

  private objectUrl(path: string): string {
    const { url, bucket } = this.config;
    return `${url}/storage/v1/object/${bucket}/${this.encode(path)}`;
  }

  private auth() {
    const { serviceRoleKey } = this.config;
    return { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey };
  }

  private encode(path: string): string {
    return path.split('/').map(encodeURIComponent).join('/');
  }
}
