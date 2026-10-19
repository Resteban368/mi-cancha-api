import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

export function Button({
  variant = 'primary',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost'; loading?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-accent text-accent-fg hover:brightness-110',
        variant === 'secondary' && 'border border-border bg-surface text-fg hover:bg-surface-2',
        variant === 'ghost' && 'text-fg-2 hover:bg-surface-2 hover:text-fg',
        className,
      )}
      {...props}
    >
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />}
      {children}
    </button>
  );
}

export const inputClass =
  'min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-base text-fg placeholder:text-fg-3 ' +
  'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';

export function Field({
  label,
  hint,
  optional,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; optional?: boolean }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label} {optional && <span className="font-normal text-fg-3">(opcional)</span>}
      </label>
      <input id={id} className={className ? `${inputClass} ${className}` : inputClass} {...props} />
      {hint && <p className="text-xs text-fg-3">{hint}</p>}
    </div>
  );
}

/** Contraseña con botón para mostrarla u ocultarla. */
export function PasswordField({
  label,
  hint,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string; hint?: string }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input id={id} type={visible ? 'text' : 'password'} className={cx(inputClass, 'pr-12')} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-fg-3 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {hint && <p className="text-xs text-fg-3">{hint}</p>}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.9 9.9 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

/** Diálogo modal: se cierra con Escape o tocando el fondo, y enfoca su primer botón. */
export function Dialog({
  open,
  onClose,
  labelledBy,
  wide = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  /** Más ancho en pantallas grandes (galerías, tablas). */
  wide?: boolean;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    document.addEventListener('keydown', onKey);
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 shadow-2xl sm:rounded-3xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        {children}
      </div>
    </div>
  );
}

export function Alert({ tone = 'danger', children }: { tone?: 'danger' | 'warn' | 'success'; children: ReactNode }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cx(
        'rounded-xl border px-4 py-3 text-sm',
        tone === 'danger' && 'border-danger/30 bg-danger-soft text-danger',
        tone === 'warn' && 'border-warn/30 bg-warn-soft text-warn',
        tone === 'success' && 'border-accent/30 bg-accent-soft text-accent',
      )}
    >
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xl bg-surface-2', className)} />;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-2xl border border-border bg-surface p-4 sm:p-5', className)}>{children}</section>;
}
