import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, errorMessage } from './api';

/** Carga `path` (null = no pedir nada) y lo recarga cuando cambia o con reload(). */
export function useApi<T>(path: string | null, token?: string | null) {
  const [version, setVersion] = useState(0);
  const key = `${path}#${token ?? ''}#${version}`;
  const [state, setState] = useState<{ key: string; data?: T; error?: string; status?: number }>({ key: '' });

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    api<T>(path, { token })
      .then((data) => !cancelled && setState({ key, data }))
      .catch(
        (error: unknown) =>
          !cancelled &&
          setState((s) => ({
            key,
            data: s.data,
            error: errorMessage(error),
            status: error instanceof ApiError ? error.status : undefined,
          })),
      );
    return () => {
      cancelled = true;
    };
  }, [path, token, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const settled = !path || state.key === key;
  return {
    data: state.data,
    error: settled ? state.error : undefined,
    status: settled ? state.status : undefined,
    loading: !settled,
    reload,
  };
}
