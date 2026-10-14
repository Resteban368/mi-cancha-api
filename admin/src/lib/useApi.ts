import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from './api';

interface ApiState<T> {
  /** Petición (ruta + versión) a la que corresponden data y error. */
  key: string;
  data: T | undefined;
  error: string | undefined;
}

/**
 * Carga `path` y lo recarga cuando cambia o al llamar `reload()`. Mientras
 * carga conserva los datos anteriores para no hacer parpadear la pantalla.
 */
export function useApi<T>(path: string) {
  const [version, setVersion] = useState(0);
  const key = `${path}#${version}`;
  const [state, setState] = useState<ApiState<T>>({
    key: '',
    data: undefined,
    error: undefined,
  });

  useEffect(() => {
    let cancelled = false;
    api<T>(path)
      .then((data) => {
        if (!cancelled) setState({ key, data, error: undefined });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setState((s) => ({ key, data: s.data, error: errorMessage(error) }));
      });
    return () => {
      cancelled = true;
    };
  }, [path, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const settled = state.key === key;
  return {
    data: state.data,
    error: settled ? state.error : undefined,
    loading: !settled,
    reload,
  };
}

/** Devuelve `value` cuando deja de cambiar durante `delay` ms. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
