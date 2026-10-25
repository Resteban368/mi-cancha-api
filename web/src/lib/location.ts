/** Ciudad desde la que el jugador busca sedes; se guarda en el navegador. */
export interface SavedCity {
  /** null = «Todas las ciudades». */
  cityId: string | null;
  /** Texto para el botón, p. ej. «Florencia» o «Todas las ciudades». */
  label: string;
}

const KEY = 'mi-cancha-city';
const SKIPPED_KEY = 'mi-cancha-city-skipped';

export const ALL_CITIES: SavedCity = { cityId: null, label: 'Todas las ciudades' };

export function readCity(): SavedCity | null {
  try {
    // La ubicación por mapa de una versión anterior ya no se usa.
    localStorage.removeItem('mi-cancha-location');
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SavedCity>;
    if (typeof value.label !== 'string') return null;
    return { cityId: typeof value.cityId === 'string' ? value.cityId : null, label: value.label };
  } catch {
    return null;
  }
}

export function saveCity(city: SavedCity | null) {
  try {
    if (city) localStorage.setItem(KEY, JSON.stringify(city));
    else localStorage.removeItem(KEY);
    sessionStorage.removeItem(SKIPPED_KEY);
  } catch {
    // Sin almacenamiento la ciudad dura lo que la pestaña.
  }
}

/** «Ahora no»: no se vuelve a preguntar durante esta sesión del navegador. */
export function skipCityPrompt() {
  try {
    sessionStorage.setItem(SKIPPED_KEY, '1');
  } catch {
    // Solo se pierde el recordatorio.
  }
}

export function cityPromptSkipped(): boolean {
  try {
    return sessionStorage.getItem(SKIPPED_KEY) === '1';
  } catch {
    return false;
  }
}
