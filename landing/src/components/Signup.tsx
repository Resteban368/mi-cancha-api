import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { fetchCiudades, fetchDepartamentos, signupBusiness, type Lugar } from '../lib/api';
import { PANEL_URL, POLICY_URL, WHATSAPP_URL } from '../config';
import { Icon } from './Icon';
import { SearchSelect } from './SearchSelect';
import { CtaLink, SectionTitle } from './ui';

type Campo =
  | 'fullName'
  | 'email'
  | 'phone'
  | 'password'
  | 'confirm'
  | 'businessName'
  | 'department'
  | 'cityId'
  | 'address'
  | 'neighborhood'
  | 'policy';

type Valores = Record<Exclude<Campo, 'policy' | 'department' | 'cityId'>, string>;

const VACIO: Valores = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirm: '',
  businessName: '',
  address: '',
  neighborhood: '',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Dígitos con +, espacios, guiones o paréntesis: «+57 300 123 4567». */
const CELULAR_RE = /^\+?[\d\s()-]+$/;

/** Mensaje de cada campo: los mismos límites que valida la API (SignupBusinessDto). */
const AYUDA: Partial<Record<Campo, string>> = {
  fullName: 'Escribe tu nombre completo (entre 2 y 100 caracteres).',
  email: 'Escribe un correo válido.',
  phone: 'Escribe tu celular (entre 7 y 20 caracteres).',
  password: 'La contraseña debe tener entre 8 y 72 caracteres.',
  businessName: 'Escribe el nombre del negocio (entre 2 y 120 caracteres).',
  address: 'Escribe la dirección (entre 3 y 200 caracteres).',
  neighborhood: 'Escribe el barrio (entre 2 y 120 caracteres).',
  cityId: 'Elige la ciudad.',
};

const largo = (v: string, min: number, max: number) => v.trim().length >= min && v.trim().length <= max;

function validar(v: Valores, departamento: string | null, ciudad: string | null, politica: boolean) {
  const e: Partial<Record<Campo, string>> = {};
  if (!largo(v.fullName, 2, 100)) e.fullName = AYUDA.fullName;
  if (!EMAIL_RE.test(v.email.trim())) e.email = AYUDA.email;
  if (!largo(v.phone, 7, 20) || !CELULAR_RE.test(v.phone.trim())) e.phone = AYUDA.phone;
  if (v.password.length < 8 || v.password.length > 72) e.password = AYUDA.password;
  if (v.confirm !== v.password) e.confirm = 'Las contraseñas no coinciden.';
  if (!largo(v.businessName, 2, 120)) e.businessName = AYUDA.businessName;
  if (!departamento) e.department = 'Elige el departamento.';
  if (!ciudad) e.cityId = AYUDA.cityId;
  if (!largo(v.address, 3, 200)) e.address = AYUDA.address;
  if (!largo(v.neighborhood, 2, 120)) e.neighborhood = AYUDA.neighborhood;
  if (!politica) e.policy = 'Debes aceptar la política de tratamiento de datos.';
  return e;
}

/** Lleva los mensajes 400 de la API al campo que nombran; el resto queda como error general. */
function repartirErrores(messages: string[]) {
  const campos: Partial<Record<Campo, string>> = {};
  const generales: string[] = [];
  for (const m of messages) {
    const campo = (Object.keys(AYUDA) as Campo[]).find((c) => m.startsWith(c));
    if (campo) campos[campo] = AYUDA[campo];
    else generales.push(m);
  }
  return { campos, generales };
}

export function Signup() {
  const [valores, setValores] = useState<Valores>(VACIO);
  const [departamento, setDepartamento] = useState<string | null>(null);
  const [ciudad, setCiudad] = useState<string | null>(null);
  const [politica, setPolitica] = useState(false);
  const [verClave, setVerClave] = useState(false);
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
  const [general, setGeneral] = useState<string[]>([]);
  const [correoEnUso, setCorreoEnUso] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const seccionRef = useRef<HTMLElement>(null);

  const [departamentos, setDepartamentos] = useState<Lugar[]>([]);
  const [depEstado, setDepEstado] = useState<'cargando' | 'error' | 'ok'>('cargando');
  const [ciudades, setCiudades] = useState<Lugar[]>([]);
  const [ciuEstado, setCiuEstado] = useState<'inactivo' | 'cargando' | 'error' | 'ok'>('inactivo');
  const [reintento, setReintento] = useState(0);

  useEffect(() => {
    let vivo = true;
    setDepEstado('cargando');
    fetchDepartamentos()
      .then((lista) => {
        if (!vivo) return;
        setDepartamentos(lista);
        setDepEstado('ok');
      })
      .catch(() => vivo && setDepEstado('error'));
    return () => {
      vivo = false;
    };
  }, [reintento]);

  useEffect(() => {
    if (!departamento) {
      setCiudades([]);
      setCiuEstado('inactivo');
      return;
    }
    let vivo = true;
    setCiuEstado('cargando');
    fetchCiudades(departamento)
      .then((lista) => {
        if (!vivo) return;
        setCiudades(lista);
        setCiuEstado('ok');
      })
      .catch(() => vivo && setCiuEstado('error'));
    return () => {
      vivo = false;
    };
  }, [departamento, reintento]);

  // Lleva el foco al primer campo con error, para que no quede fuera de la vista.
  const enfocarError = () =>
    setTimeout(() =>
      seccionRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus({ preventScroll: false }),
    );

  const cambiar = (campo: keyof Valores) => (valor: string) => {
    setValores((v) => ({ ...v, [campo]: valor }));
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
    if (campo === 'email') setCorreoEnUso(false);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setGeneral([]);
    setCorreoEnUso(false);

    const encontrados = validar(valores, departamento, ciudad, politica);
    setErrores(encontrados);
    if (Object.keys(encontrados).length) {
      enfocarError();
      return;
    }

    setEnviando(true);
    const resultado = await signupBusiness({
      fullName: valores.fullName.trim(),
      email: valores.email.trim().toLowerCase(),
      password: valores.password,
      phone: valores.phone.trim(),
      businessName: valores.businessName.trim(),
      address: valores.address.trim(),
      neighborhood: valores.neighborhood.trim(),
      cityId: ciudad!,
    });
    setEnviando(false);

    if (resultado.ok) {
      // No se guarda el token ni la clave: el dueño entra después al panel con su correo y clave.
      setValores(VACIO);
      setListo(true);
      seccionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (resultado.kind === 'email-taken') {
      setCorreoEnUso(true);
      enfocarError();
    } else if (resultado.kind === 'invalid') {
      const { campos, generales } = repartirErrores(resultado.messages);
      setErrores(campos);
      setGeneral(generales);
      enfocarError();
    } else {
      setGeneral(['No pudimos crear tu cuenta, intenta de nuevo.']);
    }
  };

  return (
    <section id="registro" ref={seccionRef} className="scroll-mt-20 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-3xl">
        {listo ? (
          <Exito />
        ) : (
          <>
            <SectionTitle
              eyebrow="Prueba gratis 15 días"
              title="Crea tu negocio y empieza a recibir reservas."
              lead="Sin tarjeta. Hasta 2 canchas y todo el panel durante 15 días."
            />

            <form
              noValidate
              onSubmit={onSubmit}
              className="mt-10 rounded-3xl border border-border bg-surface p-6 sm:p-9"
            >
              <Grupo titulo="Tus datos">
                <Campo
                  label="Nombre completo"
                  value={valores.fullName}
                  onChange={cambiar('fullName')}
                  error={errores.fullName}
                  autoComplete="name"
                  maxLength={100}
                />
                <Campo
                  label="Correo"
                  type="email"
                  value={valores.email}
                  onChange={cambiar('email')}
                  error={
                    correoEnUso ? (
                      <>
                        El email ya está registrado.{' '}
                        <a href={PANEL_URL} className="underline underline-offset-2">
                          Iniciar sesión
                        </a>
                      </>
                    ) : (
                      errores.email
                    )
                  }
                  autoComplete="email"
                  inputMode="email"
                />
                <Campo
                  label="Celular"
                  type="tel"
                  value={valores.phone}
                  onChange={cambiar('phone')}
                  error={errores.phone}
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={20}
                  placeholder="+57 300 123 4567"
                />
                <div className="hidden sm:block" />
                <Campo
                  label="Contraseña"
                  type={verClave ? 'text' : 'password'}
                  value={valores.password}
                  onChange={cambiar('password')}
                  error={errores.password}
                  autoComplete="new-password"
                  maxLength={72}
                  hint="Mínimo 8 caracteres."
                  extra={
                    <button
                      type="button"
                      onClick={() => setVerClave((v) => !v)}
                      className="text-xs font-bold text-accent-text"
                      aria-pressed={verClave}
                    >
                      {verClave ? 'Ocultar' : 'Mostrar'}
                    </button>
                  }
                />
                <Campo
                  label="Repetir contraseña"
                  type={verClave ? 'text' : 'password'}
                  value={valores.confirm}
                  onChange={cambiar('confirm')}
                  error={errores.confirm}
                  autoComplete="new-password"
                  maxLength={72}
                />
              </Grupo>

              <Grupo titulo="Tu negocio">
                <div className="sm:col-span-2">
                  <Campo
                    label="Nombre del negocio"
                    value={valores.businessName}
                    onChange={cambiar('businessName')}
                    error={errores.businessName}
                    autoComplete="organization"
                    maxLength={120}
                    placeholder="Ej.: Cancha El Golazo"
                  />
                </div>
                <SearchSelect
                  label="Departamento"
                  placeholder="Elige el departamento"
                  options={departamentos}
                  value={departamento}
                  onChange={(id) => {
                    if (id === departamento) return;
                    setDepartamento(id);
                    setCiudad(null);
                    setErrores((e) => ({ ...e, department: undefined, cityId: undefined }));
                  }}
                  loading={depEstado === 'cargando'}
                  loadError={depEstado === 'error'}
                  onRetry={() => setReintento((n) => n + 1)}
                  error={errores.department}
                />
                <SearchSelect
                  label="Ciudad"
                  placeholder="Elige la ciudad"
                  options={ciudades}
                  value={ciudad}
                  onChange={(id) => {
                    setCiudad(id);
                    setErrores((e) => ({ ...e, cityId: undefined }));
                  }}
                  disabled={!departamento}
                  disabledHint="Primero elige el departamento"
                  loading={ciuEstado === 'cargando'}
                  loadError={ciuEstado === 'error'}
                  onRetry={() => setReintento((n) => n + 1)}
                  error={errores.cityId}
                />
                <Campo
                  label="Dirección"
                  value={valores.address}
                  onChange={cambiar('address')}
                  error={errores.address}
                  autoComplete="street-address"
                  maxLength={200}
                  placeholder="Calle 10 # 5-20"
                />
                <Campo
                  label="Barrio"
                  value={valores.neighborhood}
                  onChange={cambiar('neighborhood')}
                  error={errores.neighborhood}
                  maxLength={120}
                />
              </Grupo>

              <label className="mt-8 flex items-start gap-3 text-sm text-fg-2">
                <input
                  type="checkbox"
                  checked={politica}
                  onChange={(e) => {
                    setPolitica(e.target.checked);
                    setErrores((er) => ({ ...er, policy: undefined }));
                  }}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
                  aria-invalid={!!errores.policy}
                />
                <span>
                  Acepto la{' '}
                  <a href={POLICY_URL} target="_blank" rel="noopener noreferrer" className="font-bold text-accent-text underline underline-offset-2">
                    política de tratamiento de datos
                  </a>
                  .
                </span>
              </label>
              {errores.policy && <p className="mt-1.5 text-xs font-semibold text-danger">{errores.policy}</p>}

              {general.length > 0 && (
                <div role="alert" className="mt-6 rounded-xl border border-danger/50 px-4 py-3 text-sm text-danger">
                  {general.map((m) => (
                    <p key={m}>{m}</p>
                  ))}
                </div>
              )}

              <button
                type="submit"
                disabled={enviando}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-bold text-accent-fg shadow-[0_8px_30px_-8px_rgba(0,200,83,0.55)] transition-opacity disabled:cursor-wait disabled:opacity-60"
              >
                {enviando ? 'Creando tu cuenta…' : 'Prueba gratis 15 días'}
              </button>

              <p className="mt-4 text-center text-xs leading-relaxed text-fg-3">
                Al terminar los 15 días eliges un plan para seguir creando reservas y canchas. Si no lo haces,
                igual puedes seguir consultando tu información.
              </p>
            </form>
          </>
        )}
      </div>
    </section>
  );
}

function Exito() {
  return (
    <div role="status" className="rounded-3xl border border-accent/50 bg-surface p-8 text-center sm:p-12">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg">
        <Icon name="check" className="h-7 w-7" />
      </span>
      <h2 className="mt-6 text-3xl font-extrabold tracking-tight">¡Listo! Tu prueba de 15 días ya empezó</h2>
      <p className="mx-auto mt-3 max-w-lg text-fg-2">
        Entra a tu panel con el correo y la contraseña que acabas de crear.
      </p>

      <ol className="mx-auto mt-8 max-w-md space-y-3 text-left">
        {['Crea tu primera cancha con su foto principal.', 'Comparte tu link de reservas con tus jugadores.'].map(
          (paso, i) => (
            <li key={paso} className="flex gap-3 rounded-2xl bg-surface-2 p-4 text-sm">
              <span className="font-extrabold text-accent-text">{i + 1}</span>
              <span>{paso}</span>
            </li>
          ),
        )}
      </ol>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <a
          href={PANEL_URL}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-accent px-6 py-3 text-sm font-bold text-accent-fg"
        >
          Entrar a mi panel
        </a>
        <CtaLink href={WHATSAPP_URL} variant="ghost">
          ¿Dudas? Escríbenos por WhatsApp
        </CtaLink>
      </div>
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="mt-8 first:mt-0">
      <legend className="mb-4 text-xs font-bold tracking-[0.18em] text-accent-text uppercase">{titulo}</legend>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Campo({
  label,
  value,
  onChange,
  error,
  hint,
  extra,
  type = 'text',
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: ReactNode;
  hint?: string;
  extra?: ReactNode;
  type?: string;
  autoComplete?: string;
  inputMode?: 'email' | 'tel' | 'text';
  maxLength?: number;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {extra}
      </div>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-xl border bg-surface px-4 py-3 text-sm text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-accent ${
          error ? 'border-danger' : 'border-border'
        }`}
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-semibold text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-fg-3">{hint}</p>
      )}
    </div>
  );
}
