import { useEffect, useState } from 'react';

/** Preferencia del usuario: seguir al sistema o fijar claro u oscuro. */
export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'mi-cancha-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

export function readMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

/** Pone data-theme (claro u oscuro) en <html> y el color de la barra del navegador. */
export function applyMode(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && window.matchMedia(DARK_QUERY).matches);
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.mode = mode;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#0b1f28' : '#f8fafc');
}

export function saveMode(mode: ThemeMode) {
  try {
    if (mode === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Sin almacenamiento la preferencia dura lo que la pestaña.
  }
  applyMode(mode);
}

/** Modo elegido; en "sistema" se actualiza solo cuando cambia el tema del dispositivo. */
export function useThemeMode(): [ThemeMode, (mode: ThemeMode) => void] {
  const [mode, setMode] = useState<ThemeMode>(readMode);

  useEffect(() => {
    if (mode !== 'system') return;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = () => applyMode('system');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [mode]);

  return [
    mode,
    (next) => {
      setMode(next);
      saveMode(next);
    },
  ];
}
