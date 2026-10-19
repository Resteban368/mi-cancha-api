import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { Player, PlayerSession } from './types';

const STORAGE_KEY = 'mi-cancha-player-session';

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
