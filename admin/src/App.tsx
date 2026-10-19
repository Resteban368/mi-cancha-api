import { Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { useAuth } from './lib/auth-context';
import { AuditPage } from './pages/AuditPage';
import { CatalogsPage } from './pages/CatalogsPage';
import { ClientDetailPage } from './pages/ClientDetailPage';
import { ClientsPage } from './pages/ClientsPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { PlansPage } from './pages/PlansPage';
import { UsersPage } from './pages/UsersPage';

export function App() {
  const { user } = useAuth();
  if (!user) return <LoginPage />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="clientes" element={<ClientsPage />} />
        <Route path="clientes/:id" element={<ClientDetailPage />} />
        <Route path="usuarios" element={<UsersPage />} />
        <Route path="planes" element={<PlansPage />} />
        <Route path="catalogos" element={<CatalogsPage />} />
        <Route path="auditoria" element={<AuditPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
