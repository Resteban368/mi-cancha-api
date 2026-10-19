import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ACCOUNT_BANNED_EVENT } from './api';
import type { Player, PlayerSession } from './types';

const STORAGE_KEY = 'mi-cancha-player-session';
const BANNED_NOTICE_KEY = 'mi-cancha-banned-notice';

/** true una sola vez si la sesión se cerró porque la cuenta fue bloqueada (para avisarlo al ingresar). */
export function takeBannedNotice(): boolean {
  try {
    const banned = sessionStorage.getItem(BANNED_NOTICE_KEY) === '1';
    sessionStorage.removeItem(BANNED_NOTICE_KEY);
    return banned;
  } catch {
    return false;
  }
}

interface SessionContext {
  token: string | null;
  player: Player | null;
  signIn: (session: PlayerSession) => void;
  /** Guarda los datos actualizados del jugador (p. ej. desde "Mi perfil"). */
  setPlayer: (player: Player) => void;
  signOut: () => void;
}

const Context = createContext<SessionContext | null>(null);

function read(): PlayerSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PlayerSession) : null;
  } catch {
    return null;
  }
}

function write(session: PlayerSession | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sin almacenamiento la sesión dura lo que la pestaña.
  }
}

/** Sesión del jugador (vale para todas las sedes: la cuenta es global). */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PlayerSession | null>(read);

  const signIn = useCallback((next: PlayerSession) => {
    write(next);
    setSession(next);
  }, []);
  const signOut = useCallback(() => {
    write(null);
    setSession(null);
  }, []);
  // Si bloquean la cuenta con la sesión abierta, se cierra y se avisa en la pantalla de ingreso.
  useEffect(() => {
    const onBanned = () => {
      try {
        sessionStorage.setItem(BANNED_NOTICE_KEY, '1');
      } catch {
        // Sin almacenamiento solo se pierde el aviso.
      }
      signOut();
    };
    window.addEventListener(ACCOUNT_BANNED_EVENT, onBanned);
    return () => window.removeEventListener(ACCOUNT_BANNED_EVENT, onBanned);
  }, [signOut]);
  const setPlayer = useCallback((player: Player) => {
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, player };
      write(next);
      return next;
    });
  }, []);

  return (
    <Context.Provider
      value={{
        token: session?.accessToken ?? null,
        player: session?.player ?? null,
        signIn,
        setPlayer,
        signOut,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useSession(): SessionContext {
  const value = useContext(Context);
  if (!value) throw new Error('useSession fuera de SessionProvider');
  return value;
}
