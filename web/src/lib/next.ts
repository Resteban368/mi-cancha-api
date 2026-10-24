/** Ruta interna a la que volver tras iniciar sesión. Nunca sale de la web (evita `//otro-sitio`). */
export function safeNext(raw: string | null | undefined): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
}

/** Pantalla de cuenta (ingresar, registro o recuperar) que vuelve a `next` al terminar. */
export function accountPath(page: 'ingresar' | 'registro' | 'recuperar', next: string): string {
  return `/${page}?next=${encodeURIComponent(safeNext(next))}`;
}

/** Clave donde se guarda la reserva a medias de una sede mientras el jugador inicia sesión. */
export const pendingBookingKey = (slug: string) => `mi-cancha-pending:${slug}`;

/**
 * A dónde ir al iniciar sesión: siempre a "Mis reservas", salvo que venga de reservar en una sede
 * (tiene una selección guardada), que vuelve a ella para terminar la reserva.
 */
export function afterLoginPath(next: string): string {
  const slug = safeNext(next).split(/[?#]/)[0].split('/')[1];
  try {
    if (slug && sessionStorage.getItem(pendingBookingKey(slug))) return safeNext(next);
  } catch {
    // Sin almacenamiento no hay reserva a medias que recuperar.
  }
  return '/reservas';
}
