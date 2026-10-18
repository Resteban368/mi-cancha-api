export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/** Petición a /api/v1 con el token del jugador si hay sesión. */
export async function api<T>(
  path: string,
  options: {
    method?: Method;
    body?: unknown;
    token?: string | null;
    /** Termina aunque se cierre la página (para soltar un apartado). */
    keepalive?: boolean;
  } = {},
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    method: options.method ?? 'GET',
    keepalive: options.keepalive,
    headers: {
      'Content-Type': 'application/json',
      ...(options.token && { Authorization: `Bearer ${options.token}` }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string | string[];
      code?: string;
    } | null;
    const message = Array.isArray(payload?.message)
      ? payload.message.join('. ')
      : (payload?.message ?? `Error ${response.status}`);
    throw new ApiError(response.status, message, payload?.code);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return 'No se pudo conectar. Revisa tu internet e inténtalo de nuevo.';
  return 'Ocurrió un error inesperado';
}
