import type { ReactNode } from 'react';
import { useThemeMode, type ThemeMode } from '../lib/theme';

const icon = (children: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-4"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const OPTIONS: { mode: ThemeMode; label: string; icon: ReactNode }[] = [
  {
    mode: 'light',
    label: 'Claro',
    icon: icon(
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>,
    ),
  },
  {
    mode: 'system',
    label: 'Sistema',
    icon: icon(
      <>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </>,
    ),
  },
  {
    mode: 'dark',
    label: 'Oscuro',
    icon: icon(<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />),
  },
];

const NEXT: Record<ThemeMode, ThemeMode> = { light: 'dark', dark: 'system', system: 'light' };

/**
 * Selector de apariencia: claro, sistema u oscuro (se recuerda en el navegador).
 * `cycle` es un solo botón que va rotando entre los tres, para las barras con poco espacio.
 */
export function ThemeToggle({ className = '', cycle = false }: { className?: string; cycle?: boolean }) {
  const [mode, setMode] = useThemeMode();
  if (cycle) {
    const current = OPTIONS.find((o) => o.mode === mode)!;
    return (
      <button
        type="button"
        onClick={() => setMode(NEXT[mode])}
        aria-label={`Apariencia: ${current.label}. Cambiar`}
        title={`Apariencia: ${current.label}`}
        className={`flex size-9 items-center justify-center rounded-xl border border-hairline bg-surface text-fg-2 transition hover:text-fg active:scale-95 ${className}`}
      >
        {current.icon}
      </button>
    );
  }
  return (
    <div
      role="group"
      aria-label="Apariencia"
      className={`inline-flex items-center gap-0.5 rounded-full border border-hairline bg-surface-2 p-0.5 ${className}`}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.mode}
          type="button"
          onClick={() => setMode(o.mode)}
          aria-pressed={mode === o.mode}
          aria-label={`Modo ${o.label.toLowerCase()}`}
          title={o.label}
          className={`flex size-7 items-center justify-center rounded-full transition ${
            mode === o.mode ? 'bg-accent text-accent-fg shadow-sm' : 'text-fg-3 hover:text-fg'
          }`}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
