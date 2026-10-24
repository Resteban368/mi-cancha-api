import { Navigate, Route, Routes, useLocation, useParams } from 'react-router';
import { LoginPage, RegisterPage, ResetPasswordPage, WelcomePage } from './pages/AuthPages';
import { ProfilePage } from './pages/ProfilePage';
import { BusinessPage } from './pages/BusinessPage';
import { DirectoryPage } from './pages/DirectoryPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { MyReservationsPage } from './pages/MyReservationsPage';
import { MySitesPage } from './pages/MySitesPage';
import { PolicyPage } from './pages/PolicyPage';
import { accountPath, safeNext } from './lib/next';
import { useSession } from './lib/session';

export function App() {
  return (
    <OnboardingGate>
      <AppRoutes />
    </OnboardingGate>
  );
}

/** Una cuenta que creó una sede debe cambiar su clave y aceptar la política antes de usar la web. */
const ACCOUNT_PAGES = ['/ingresar', '/registro', '/recuperar'];

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { player } = useSession();
  const { pathname, search } = useLocation();
  const pending = Boolean(player?.mustChangePassword || player?.needsDataConsent);
  const exempt = pathname === '/bienvenida' || pathname === '/politica-de-datos';
  if (pending && !exempt) {
    // Desde ingresar/registro/recuperar se vuelve al destino que traían, no a la pantalla de cuenta.
    const back = ACCOUNT_PAGES.includes(pathname)
      ? safeNext(new URLSearchParams(search).get('next'))
      : `${pathname}${search}`;
    return <Navigate to={`/bienvenida?next=${encodeURIComponent(back)}`} replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route index element={<DirectoryPage />} />
      <Route path="politica-de-datos" element={<PolicyPage />} />
      {/* Una sola cuenta para todas las sedes. */}
      <Route path="ingresar" element={<LoginPage />} />
      <Route path="registro" element={<RegisterPage />} />
      <Route path="recuperar" element={<ResetPasswordPage />} />
      <Route path="bienvenida" element={<WelcomePage />} />
      <Route path="perfil" element={<ProfilePage />} />
      <Route path="reservas" element={<MyBookingsPage />} />
      <Route path="mis-sedes" element={<MySitesPage />} />
      <Route path=":slug" element={<BusinessPage />} />
      <Route path=":slug/mis-reservas" element={<MyReservationsPage />} />
      {/* Links antiguos de cuenta por sede: llevan a la cuenta general. */}
      <Route path=":slug/ingresar" element={<LegacyAccountRedirect page="ingresar" />} />
      <Route path=":slug/registro" element={<LegacyAccountRedirect page="registro" />} />
      <Route path=":slug/recuperar" element={<LegacyAccountRedirect page="recuperar" />} />
      <Route path=":slug/perfil" element={<Navigate to="/perfil" replace />} />
      <Route path="*" element={<DirectoryPage />} />
    </Routes>
  );
}

function LegacyAccountRedirect({ page }: { page: 'ingresar' | 'registro' | 'recuperar' }) {
  const { slug = '' } = useParams();
  return <Navigate to={accountPath(page, `/${slug}`)} replace />;
}
