import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Header } from '../components/Header';
import { Alert, Button, Card, Field, PasswordField } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { useSession } from '../lib/session';
import type { PlayerSession } from '../lib/types';

function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const { slug = '' } = useParams();
  return (
    <>
      <Header slug={slug} />
      <main className="mx-auto max-w-md px-4 py-6">
        <img
          src={`${import.meta.env.BASE_URL}brand/logo-full.png`}
          alt="Mi Cancha · Encuentra, reserva, juega"
          width={320}
          height={271}
          className="mx-auto mb-5 h-auto w-full max-w-[220px] rounded-2xl border border-border shadow-sm"
        />
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
    <AuthLayout title="Ingresa a tu cuenta" subtitle="Con tu celular y tu contraseña.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        <Field
          label="Celular"
          type="tel"
          autoComplete="username"
          inputMode="tel"
          required
          value={form.identifier}
          onChange={(e) => setForm({ ...form, identifier: e.target.value })}
        />
        <PasswordField
          label="Contraseña"
          autoComplete="current-password"
          required
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <Button type="submit" loading={saving}>
          Ingresar
        </Button>
        <Link to={`/${slug}/recuperar`} className="-mt-1 text-center text-sm font-semibold text-accent">
          ¿Olvidaste tu contraseña?
        </Link>
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

const EMPTY = { fullName: '', phone: '', password: '' };

export function RegisterPage() {
  const { slug = '' } = useParams();
  const { signIn } = useSession();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  // Paso 2: el código que llegó por SMS al celular.
  const [codeSent, setCodeSent] = useState(false);
  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const payload = () => ({ ...form, fullName: form.fullName.trim(), acceptDataPolicy: accepted });

  /** Valida los datos y envía el código; la cuenta aún no se crea. */
  async function sendCode() {
    await api<unknown>('/public/auth/register/code', { method: 'POST', body: payload() });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      await sendCode();
      setCodeSent(true);
    } catch (e) {
      setError(errorMessage(e));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  }

  async function confirm(code: string) {
    const session = await api<PlayerSession>('/public/auth/register', {
      method: 'POST',
      body: { ...payload(), code },
    });
    signIn(session);
    navigate(`/${slug}`);
  }

  if (codeSent) {
    return (
      <AuthLayout title="Verifica tu celular" subtitle="Es el último paso para crear tu cuenta.">
        <CodeStep
          phone={form.phone}
          submitLabel="Crear cuenta"
          onSubmit={confirm}
          onResend={sendCode}
          onChangePhone={() => setCodeSent(false)}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Crea tu cuenta"
      subtitle="Solo tu nombre, tu celular y una contraseña. El resto lo completas después en Mi perfil."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Nombre completo" autoComplete="name" required minLength={2} value={form.fullName} onChange={set('fullName')} />
        <Field
          label="Celular"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          required
          value={form.phone}
          onChange={set('phone')}
          hint="Te enviaremos un código por SMS. Lo usarás para ingresar."
        />
        <PasswordField
          label="Contraseña"
          autoComplete="new-password"
          required
          minLength={8}
          value={form.password}
          onChange={set('password')}
          hint="Mínimo 8 caracteres"
        />
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
          Enviar código por SMS
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

/** Segundos antes de poder pedir otro código. */
const RESEND_SECONDS = 60;

/**
 * Paso del código que llegó por SMS: [onSubmit] recibe el código (y lanza el
 * error de la API si es incorrecto); [onResend] pide otro.
 */
function CodeStep({
  phone,
  submitLabel,
  onSubmit,
  onResend,
  onChangePhone,
  children,
}: {
  phone: string;
  submitLabel: string;
  onSubmit: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onChangePhone: () => void;
  children?: React.ReactNode;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [wait, setWait] = useState(RESEND_SECONDS);
  // Solo se puede reenviar una vez (2 códigos cada 6 horas por celular).
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await onSubmit(code.trim());
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  async function resend() {
    setError(undefined);
    setNotice(undefined);
    try {
      await onResend();
      setNotice('Te enviamos un código nuevo. Era tu único reenvío.');
      setCode('');
      setResent(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-sm text-fg-2">
        Enviamos un código por SMS al <span className="font-semibold text-fg">{phone.trim()}</span>. Puede tardar
        unos segundos en llegar.
      </p>
      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}
      <Field
        label="Código"
        autoComplete="one-time-code"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        className="text-center text-2xl font-bold tracking-[0.4em]"
      />
      {children}
      <Button type="submit" loading={saving}>
        {submitLabel}
      </Button>
      <div className="flex items-center justify-between gap-3 text-sm">
        <button type="button" onClick={onChangePhone} className="font-semibold text-accent">
          Cambiar celular
        </button>
        {resent ? (
          <span className="text-right text-xs text-fg-3">Ya usaste tu reenvío</span>
        ) : wait > 0 ? (
          <span className="text-fg-3">Reenviar en {wait} s</span>
        ) : (
          <button type="button" onClick={resend} className="font-semibold text-accent">
            Reenviar código (1 vez)
          </button>
        )}
      </div>
    </form>
  );
}

/** "Olvidé mi contraseña": celular → código por SMS → contraseña nueva. */
export function ResetPasswordPage() {
  const { slug = '' } = useParams();
  const { signIn } = useSession();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const sendCode = async () => {
    await api<unknown>('/public/auth/password/code', { method: 'POST', body: { phone } });
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      await sendCode();
      setCodeSent(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function reset(code: string) {
    signIn(
      await api<PlayerSession>('/public/auth/password/reset', {
        method: 'POST',
        body: { phone, code, password },
      }),
    );
    navigate(`/${slug}`);
  }

  if (codeSent) {
    return (
      <AuthLayout
        title="Elige tu nueva contraseña"
        subtitle="Si el celular tiene una cuenta, te llegó un código por SMS."
      >
        <CodeStep
          phone={phone}
          submitLabel="Guardar e ingresar"
          onSubmit={reset}
          onResend={sendCode}
          onChangePhone={() => setCodeSent(false)}
        >
          <PasswordField
            label="Contraseña nueva"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="Mínimo 8 caracteres"
          />
        </CodeStep>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Recupera tu contraseña" subtitle="Te enviaremos un código por SMS al celular de tu cuenta.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        <Field
          label="Celular"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Button type="submit" loading={saving}>
          Enviar código por SMS
        </Button>
        <p className="text-center text-sm text-fg-2">
          ¿La recordaste?{' '}
          <Link to={`/${slug}/ingresar`} className="font-semibold text-accent">
            Ingresa
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
