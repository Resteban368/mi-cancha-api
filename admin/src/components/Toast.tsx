import { useCallback, useState, type ReactNode } from 'react';
import { ToastContext, type ToastTone } from '../lib/toast';
import { AlertIcon, CheckIcon } from './icons';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { id, message, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4000);
  }, []);
  return (
    <ToastContext value={notify}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:left-auto sm:right-6 sm:items-end"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex max-w-sm items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-fg shadow-lg"
          >
            <span className={toast.tone === 'success' ? 'text-accent-text' : 'text-danger'}>
              {toast.tone === 'success' ? <CheckIcon /> : <AlertIcon />}
            </span>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext>
  );
}
