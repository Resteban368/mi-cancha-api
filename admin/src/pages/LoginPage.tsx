import { useState, type FormEvent } from 'react';
import { BrandLogo, LockIcon } from '../components/icons';
import { Button, ErrorBanner, Field, Input } from '../components/ui';
import { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth-context';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <h1 className="sr-only">Mi Cancha · Panel de administración</h1>
          {/* El logo trae su propio fondo claro: se muestra como tarjeta en ambos modos. */}
          <BrandLogo className="h-auto w-full max-w-[280px] rounded-2xl border border-border shadow-sm" />
          <p className="mt-4 text-sm font-medium text-fg-2">Panel de administración</p>
        </div>
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-sm"
        >
          {error && <ErrorBanner message={error} />}
          <Field label="Email">
            {(id) => (
              <Input
                id={id}
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>
          <Field label="Contraseña">
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
          <Button type="submit" variant="primary" loading={loading} className="mt-2">
            <LockIcon /> Ingresar
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-fg-3">
          Solo para cuentas con rol de super administrador.
        </p>
      </div>
    </div>
  );
}
