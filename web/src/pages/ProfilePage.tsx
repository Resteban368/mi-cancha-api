import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useParams } from 'react-router';
import { Header } from '../components/Header';
import { Alert, Button, Card, Field, inputClass, Skeleton } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { SPORT_LABELS } from '../lib/format';
import { useSession } from '../lib/session';
import type { Player, PublicBusiness } from '../lib/types';
import { useApi } from '../lib/useApi';

/** "Mi perfil": el jugador completa correo, cédula y lo demás después de registrarse. */
export function ProfilePage() {
  const { slug = '' } = useParams();
  const { token, setPlayer, signOut } = useSession();
  const business = useApi<PublicBusiness>(`/public/businesses/${slug}`);
  const me = useApi<Player>(token ? '/player/me' : null, token);

  useEffect(() => {
    if (me.status === 401) signOut();
  }, [me.status, signOut]);

  if (!token) return <Navigate to={`/${slug}/ingresar`} replace />;

  return (
    <>
      <Header slug={slug} businessName={business.data?.name} />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <h1 className="text-xl font-bold">Mi perfil</h1>
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
          <Skeleton className="h-96" />
        )}
      </main>
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
            <span className="text-xs font-semibold text-accent">Verificado</span>
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
