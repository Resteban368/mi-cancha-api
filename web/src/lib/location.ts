/** Ubicación desde la que el jugador busca sedes; se guarda en el navegador. */
export interface SavedLocation {
  lat: number;
  lng: number;
  /** Radio de búsqueda en km; null = sin límite (solo ordena por cercanía). */
  radiusKm: number | null;
}

const KEY = 'mi-cancha-location';
const SKIPPED_KEY = 'mi-cancha-location-skipped';

export const RADIUS_OPTIONS: (number | null)[] = [5, 10, 25, 50, null];
export const DEFAULT_RADIUS_KM = 25;

export function readLocation(): SavedLocation | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SavedLocation>;
    if (typeof value.lat !== 'number' || typeof value.lng !== 'number') return null;
    return { lat: value.lat, lng: value.lng, radiusKm: typeof value.radiusKm === 'number' ? value.radiusKm : null };
  } catch {
    return null;
  }
}

export function saveLocation(location: SavedLocation | null) {
  try {
    if (location) localStorage.setItem(KEY, JSON.stringify(location));
    else localStorage.removeItem(KEY);
    sessionStorage.removeItem(SKIPPED_KEY);
  } catch {
    // Sin almacenamiento la ubicación dura lo que la pestaña.
  }
}

/** «Ahora no»: no se vuelve a preguntar durante esta sesión del navegador. */
export function skipLocationPrompt() {
  try {
    sessionStorage.setItem(SKIPPED_KEY, '1');
  } catch {
    // Solo se pierde el recordatorio.
  }
}

export function locationPromptSkipped(): boolean {
  try {
    return sessionStorage.getItem(SKIPPED_KEY) === '1';
  } catch {
    return false;
  }
}

export const radiusLabel = (km: number | null) => (km === null ? 'Todas' : `${km} km`);
