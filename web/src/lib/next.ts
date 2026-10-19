/** Ruta interna a la que volver tras iniciar sesión. Nunca sale de la web (evita `//otro-sitio`). */
export function safeNext(raw: string | null | undefined): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
}

/** Pantalla de cuenta (ingresar, registro o recuperar) que vuelve a `next` al terminar. */
export function accountPath(page: 'ingresar' | 'registro' | 'recuperar', next: string): string {
  return `/${page}?next=${encodeURIComponent(safeNext(next))}`;
}
