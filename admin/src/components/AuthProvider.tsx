import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, configureApi } from '../lib/api';
import { AuthContext } from '../lib/auth-context';
import type { AuthResponse, AuthUser } from '../lib/types';

const STORAGE_KEY = 'mi-cancha-admin-session';

interface Session {
  token: string;
  user: AuthUser;
}

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function writeSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sin almacenamiento la sesión dura lo que la pestaña.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => readSession());

  const logout = useCallback(() => {
    writeSession(null);
    configureApi(null, () => {});
    setSession(null);
  }, []);

  // Se configura en el render para que el primer fetch ya lleve el token.
  configureApi(session?.token ?? null, logout);

  const login = useCallback(async (email: string, password: string) => {
    configureApi(null, () => {});
    const result = await api<AuthResponse>('/auth/business/login', {
      method: 'POST',
      body: { email, password },
    });
    if (result.user.role !== 'SUPER_ADMIN') {
      throw new ApiError(403, 'Esta cuenta no tiene acceso al panel de administración');
    }
    const next = { token: result.accessToken, user: result.user };
    writeSession(next);
    setSession(next);
  }, []);

  const value = useMemo(
    () => ({ user: session?.user ?? null, login, logout }),
    [session, login, logout],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}
