import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Header } from '../components/Header';
import { Alert, Button, Card, Field, inputClass } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { SPORT_LABELS } from '../lib/format';
import { useSession } from '../lib/session';
import type { PlayerSession } from '../lib/types';

function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const { slug = '' } = useParams();
  return (
    <>
      <Header slug={slug} />
      <main className="mx-auto max-w-md px-4 py-6">
        <Card>
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="mb-5 mt-1 text-sm text-fg-2">{subtitle}</p>
          {children}
        </Card>
      </main>
    </>
  );
}

export function LoginPage() {
  const { slug = '' } = useParams();
  const { signIn } = useSession();
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      signIn(await api<PlayerSession>('/public/auth/login', { method: 'POST', body: form }));
      navigate(`/${slug}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthLayout title="Ingresa a tu cuenta" subtitle="Con tu celular o tu cédula y tu contraseña.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        <Field
          label="Celular o cédula"
          autoComplete="username"
          inputMode="numeric"
          required
          value={form.identifier}
          onChange={(e) => setForm({ ...form, identifier: e.target.value })}
        />
        <Field
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <Button type="submit" loading={saving}>
          Ingresar
        </Button>
        <p className="text-center text-sm text-fg-2">
          ¿No tienes cuenta?{' '}
          <Link to={`/${slug}/registro`} className="font-semibold text-accent">
            Regístrate
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

const EMPTY = {
  fullName: '',
  email: '',
  phone: '',
  documentId: '',
  password: '',
  birthDate: '',
  favoriteSport: '',
};

export function RegisterPage() {
  const { slug = '' } = useParams();
  const { signIn } = useSession();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      const session = await api<PlayerSession>('/public/auth/register', {
        method: 'POST',
        body: {
          ...form,
          fullName: form.fullName.trim(),
          birthDate: form.birthDate || undefined,
          favoriteSport: form.favoriteSport || undefined,
          acceptDataPolicy: accepted,
        },
      });
      signIn(session);
      navigate(`/${slug}`);
    } catch (e) {
      setError(errorMessage(e));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthLayout title="Crea tu cuenta" subtitle="Una sola cuenta para reservar en las sedes de Mi Cancha.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Nombre completo" autoComplete="name" required minLength={2} value={form.fullName} onChange={set('fullName')} />
        <Field label="Correo electrónico" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        <Field label="Celular" type="tel" autoComplete="tel" inputMode="tel" required value={form.phone} onChange={set('phone')} hint="Lo usarás para ingresar" />
        <Field label="Cédula" inputMode="numeric" required value={form.documentId} onChange={set('documentId')} hint="También sirve para ingresar" />
        <Field
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={form.password}
          onChange={set('password')}
          hint="Mínimo 8 caracteres"
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
        <label className="flex items-start gap-3 text-sm text-fg-2">
          <input
            type="checkbox"
            required
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
          />
          <span>
            Autorizo el tratamiento de mis datos personales según la{' '}
            <Link to="/politica-de-datos" target="_blank" className="font-semibold text-accent underline">
              política de tratamiento de datos
            </Link>
            .
          </span>
        </label>
        <Button type="submit" loading={saving}>
          Crear cuenta
        </Button>
        <p className="text-center text-sm text-fg-2">
          ¿Ya tienes cuenta?{' '}
          <Link to={`/${slug}/ingresar`} className="font-semibold text-accent">
            Ingresa
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
