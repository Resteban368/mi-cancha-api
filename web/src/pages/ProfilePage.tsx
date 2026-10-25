import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { Header } from '../components/Header';
import { PitchBottomNav } from '../components/PitchChrome';
import { ThemeToggle } from '../components/ThemeToggle';
import { Alert, Button, Card, Field, inputClass, PasswordField, Skeleton } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { accountPath } from '../lib/next';
import { SPORT_LABELS } from '../lib/format';
import { useSession } from '../lib/session';
import type { Player } from '../lib/types';
import { useApi } from '../lib/useApi';

/** "Mi perfil": una sola cuenta para todas las sedes; el jugador completa correo, cédula y lo demás. */
export function ProfilePage() {
  const { token, setPlayer, signOut } = useSession();
  const me = useApi<Player>(token ? '/player/me' : null, token);

  useEffect(() => {
    if (me.status === 401) signOut();
  }, [me.status, signOut]);

  if (!token) return <Navigate to={accountPath('ingresar', '/perfil')} replace />;

  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 pb-28 pt-5 sm:pb-12">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Hola{me.data ? `, ${me.data.fullName.split(' ')[0]}` : ''}
          </h1>
          <p className="mt-0.5 text-xs text-fg-3">Tus datos, para todas las sedes. Tus partidos están en Mis reservas.</p>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-col gap-4">
          {me.error && me.status !== 401 && <Alert>{me.error}</Alert>}
          {me.data ? (
            <ProfileForm
              key={me.data.id}
              player={me.data}
              token={token}
              onSaved={(player) => {
                setPlayer(player);
                me.reload();
              }}
            />
          ) : (
            <Skeleton className="h-96 rounded-2xl" />
          )}
          {me.data && <PasswordForm token={token} />}
          <Card className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Apariencia</h2>
              <p className="mt-0.5 text-xs text-fg-3">Claro, oscuro o el del dispositivo.</p>
            </div>
            <ThemeToggle />
          </Card>
        </div>
        <div className="mx-auto w-full max-w-md">
          <Button variant="secondary" onClick={signOut} className="w-full">
            Cerrar sesión
          </Button>
        </div>
      </main>
      <PitchBottomNav />
    </>
  );
}

function ProfileForm({
  player,
  token,
  onSaved,
}: {
  player: Player;
  token: string;
  onSaved: (player: Player) => void;
}) {
  const [form, setForm] = useState({
    fullName: player.fullName,
    email: player.email ?? '',
    documentId: player.documentId ?? '',
    birthDate: player.birthDate ?? '',
    favoriteSport: player.favoriteSport ?? '',
  });
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };
  const missing = [!player.email && 'correo', !player.documentId && 'cédula'].filter(Boolean);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    setSaved(false);
    try {
      const updated = await api<Player>('/player/me', {
        method: 'PATCH',
        token,
        body: {
          fullName: form.fullName.trim(),
          // Vacío = no se cambia (el correo y la cédula no se borran).
          email: form.email.trim() || undefined,
          documentId: form.documentId.trim() || undefined,
          birthDate: form.birthDate || null,
          favoriteSport: form.favoriteSport || null,
        },
      });
      onSaved(updated);
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {missing.length > 0 && (
          <Alert tone="warn">
            Completa tu {missing.join(' y ')}: las sedes los usan para identificarte al llegar.
          </Alert>
        )}
        {error && <Alert>{error}</Alert>}
        {saved && <Alert tone="success">Guardamos tus datos.</Alert>}
        <Field label="Nombre completo" autoComplete="name" required minLength={2} value={form.fullName} onChange={set('fullName')} />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Celular</span>
          <p className="flex min-h-11 items-center justify-between rounded-xl border border-border bg-surface-2 px-3 text-sm">
            {player.phone}
            <span className="text-xs font-semibold text-accent-text">Verificado</span>
          </p>
        </div>
        <Field label="Correo electrónico" type="email" autoComplete="email" value={form.email} onChange={set('email')} />
        <Field
          label="Cédula"
          inputMode="numeric"
          value={form.documentId}
          onChange={set('documentId')}
          hint="También te sirve para ingresar"
        />
        <Field label="Fecha de nacimiento" type="date" optional value={form.birthDate} onChange={set('birthDate')} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="favorite-sport" className="text-sm font-medium">
            Deporte favorito <span className="font-normal text-fg-3">(opcional)</span>
          </label>
          <select id="favorite-sport" className={inputClass} value={form.favoriteSport} onChange={set('favoriteSport')}>
            <option value="">Sin elegir</option>
            {Object.entries(SPORT_LABELS).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" loading={saving}>
          Guardar
        </Button>
      </form>
    </Card>
  );
}

/** Cambiar la contraseña: pide la actual para confirmar que es el dueño de la cuenta. */
function PasswordForm({ token }: { token: string }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setSaved(false);
    if (form.newPassword !== form.confirm) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    setSaving(true);
    try {
      await api<Player>('/player/password', {
        method: 'PUT',
        token,
        body: { currentPassword: form.currentPassword, newPassword: form.newPassword },
      });
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Cambiar contraseña</h2>
          <p className="mt-0.5 text-xs text-fg-3">Para tu seguridad, confirma tu contraseña actual.</p>
        </div>
        {error && <Alert>{error}</Alert>}
        {saved && <Alert tone="success">Contraseña actualizada.</Alert>}
        <PasswordField
          label="Contraseña actual"
          autoComplete="current-password"
          required
          value={form.currentPassword}
          onChange={set('currentPassword')}
        />
        <PasswordField
          label="Contraseña nueva"
          hint="Mínimo 8 caracteres."
          autoComplete="new-password"
          minLength={8}
          required
          value={form.newPassword}
          onChange={set('newPassword')}
        />
        <PasswordField
          label="Repite la contraseña nueva"
          autoComplete="new-password"
          minLength={8}
          required
          value={form.confirm}
          onChange={set('confirm')}
        />
        <Button type="submit" loading={saving}>
          Cambiar contraseña
        </Button>
      </form>
    </Card>
  );
}
