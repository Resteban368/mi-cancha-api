import { BadRequestException } from '@nestjs/common';

/** Vercel corta los cuerpos en 4,5 MB: 4 MB deja margen para el multipart. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Archivo recibido por multer (solo lo que usamos). */
export interface UploadedImage {
  buffer: Buffer;
  size: number;
}

/** Imagen ya validada, con su tipo real. */
export interface ValidImage extends UploadedImage {
  contentType: string;
  extension: string;
}

/** Tipos aceptados, reconocidos por su firma y no por el nombre o el mimetype del cliente. */
const IMAGE_TYPES = [
  { contentType: 'image/jpeg', extension: 'jpg', magic: [0xff, 0xd8, 0xff] },
  {
    contentType: 'image/png',
    extension: 'png',
    magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
];

/** Valida la imagen subida (presente, JPG o PNG, máx. 4 MB) y le añade su tipo. */
export function validateImage(file: UploadedImage | undefined): ValidImage {
  if (!file?.size) {
    throw new BadRequestException('Adjunta la imagen en el campo "image"');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new BadRequestException('La imagen no puede superar 4 MB');
  }
  const type = IMAGE_TYPES.find(({ magic }) =>
    magic.every((byte, i) => file.buffer[i] === byte),
  );
  if (!type) throw new BadRequestException('La imagen debe ser JPG o PNG');
  return {
    buffer: file.buffer,
    size: file.size,
    contentType: type.contentType,
    extension: type.extension,
  };
}
