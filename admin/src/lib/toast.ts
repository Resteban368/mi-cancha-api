import { createContext, useContext } from 'react';

export type ToastTone = 'success' | 'danger';
export type Notify = (message: string, tone?: ToastTone) => void;

export const ToastContext = createContext<Notify>(() => {});

/** Muestra un aviso breve abajo a la derecha. */
export const useToast = () => useContext(ToastContext);
