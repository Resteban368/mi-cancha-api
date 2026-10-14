/**
 * Almacenamiento de archivos. Las rutas son relativas a la raíz del proveedor y usan
 * `/` como separador, p. ej. `mi-cancha/business-profile/<negocio>/<id>.jpg`.
 */
export abstract class FileStorage {
  /** Guarda el archivo y crea las carpetas que falten. */
  abstract put(path: string, data: Buffer, contentType: string): Promise<void>;

  /** Contenido del archivo, o null si no existe. */
  abstract get(path: string): Promise<Buffer | null>;

  /** Borra el archivo; no falla si ya no existe. */
  abstract delete(path: string): Promise<void>;
}
