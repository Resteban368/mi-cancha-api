import { API_URL } from '../config';

export type Lugar = { id: string; code: string; name: string };

export type SignupInput = {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  businessName: string;
  address: string;
  neighborhood: string;
  cityId: string;
};

/** Resultado del registro. El token que devuelve la API no se usa ni se guarda. */
export type SignupResult =
  | { ok: true }
  | { ok: false; kind: 'email-taken' }
  | { ok: false; kind: 'invalid'; messages: string[] }
  | { ok: false; kind: 'network' };

// Caché en memoria mientras la página esté abierta: los catálogos del DANE no cambian.
let departamentos: Promise<Lugar[]> | null = null;
const ciudades = new Map<string, Promise<Lugar[]>>();

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Si la petición falla se borra de la caché, para que «Reintentar» vuelva a pedirla. */
function cached<T>(promise: Promise<T>, onError: () => void): Promise<T> {
  promise.catch(onError);
  return promise;
}

export function fetchDepartamentos(): Promise<Lugar[]> {
  departamentos ??= cached(getJson<Lugar[]>('/catalogs/departments'), () => {
    departamentos = null;
  });
  return departamentos;
}

export function fetchCiudades(departamentoId: string): Promise<Lugar[]> {
  let promise = ciudades.get(departamentoId);
  if (!promise) {
    promise = cached(getJson<Lugar[]>(`/catalogs/departments/${departamentoId}/cities`), () =>
      ciudades.delete(departamentoId),
    );
    ciudades.set(departamentoId, promise);
  }
  return promise;
}

export async function signupBusiness(input: SignupInput): Promise<SignupResult> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/business/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, kind: 'network' };
  }

  if (res.ok) return { ok: true };
  if (res.status === 409) return { ok: false, kind: 'email-taken' };
  if (res.status === 400) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const raw = body?.message;
    const messages = Array.isArray(raw) ? raw : raw ? [raw] : ['Revisa los datos del formulario.'];
    return { ok: false, kind: 'invalid', messages };
  }
  return { ok: false, kind: 'network' };
}
