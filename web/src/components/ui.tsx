import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';

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
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; optional?: boolean }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label} {optional && <span className="font-normal text-fg-3">(opcional)</span>}
      </label>
      <input id={id} className={inputClass} {...props} />
      {hint && <p className="text-xs text-fg-3">{hint}</p>}
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
