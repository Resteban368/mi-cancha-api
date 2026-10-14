import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileStorage } from './file-storage.js';

/**
 * Archivos en Koofr vía WebDAV, autenticando con el correo de la cuenta y una
 * contraseña de aplicación (Koofr → Preferencias → Contraseña → App passwords).
 */
@Injectable()
export class KoofrStorage extends FileStorage {
  private readonly logger = new Logger(KoofrStorage.name);
  private readonly baseUrl: string;
  private readonly authorization: string | null;

  constructor(config: ConfigService) {
    super();
    this.baseUrl = config
      .getOrThrow<string>('KOOFR_WEBDAV_URL')
      .replace(/\/+$/, '');
    const email = config.get<string>('KOOFR_EMAIL');
    const password = config.get<string>('KOOFR_APP_PASSWORD');
    this.authorization =
      email && password
        ? `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}`
        : null;
  }

  async put(path: string, data: Buffer, contentType: string): Promise<void> {
    await this.ensureFolders(path);
    const res = await this.request('PUT', path, {
      body: new Uint8Array(data),
      headers: { 'Content-Type': contentType },
    });
    if (!res.ok) this.fail('PUT', path, res);
  }

  async get(path: string): Promise<Buffer | null> {
    const res = await this.request('GET', path);
    if (res.status === 404) return null;
    if (!res.ok) this.fail('GET', path, res);
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(path: string): Promise<void> {
    const res = await this.request('DELETE', path);
    if (!res.ok && res.status !== 404) this.fail('DELETE', path, res);
  }

  /** WebDAV no crea carpetas intermedias: se crean una a una (405 = ya existía). */
  private async ensureFolders(path: string): Promise<void> {
    const parts = path.split('/').slice(0, -1);
    for (let i = 1; i <= parts.length; i++) {
      const folder = parts.slice(0, i).join('/');
      const res = await this.request('MKCOL', folder);
      if (!res.ok && res.status !== 405) this.fail('MKCOL', folder, res);
    }
  }

  private request(
    method: string,
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    if (!this.authorization) {
      throw new ServiceUnavailableException(
        'El almacenamiento de imágenes no está configurado',
      );
    }
    const url = `${this.baseUrl}/${path.split('/').map(encodeURIComponent).join('/')}`;
    return fetch(url, {
      ...init,
      method,
      headers: { ...init.headers, Authorization: this.authorization },
    });
  }

  private fail(method: string, path: string, res: Response): never {
    this.logger.error(`Koofr ${method} ${path} respondió ${res.status}`);
    throw new ServiceUnavailableException(
      'No se pudo acceder al almacenamiento de imágenes',
    );
  }
}
