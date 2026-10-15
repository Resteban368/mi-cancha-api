import { Route, Routes } from 'react-router';
import { Header } from './components/Header';
import { Card } from './components/ui';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { BusinessPage } from './pages/BusinessPage';
import { MyReservationsPage } from './pages/MyReservationsPage';
import { PolicyPage } from './pages/PolicyPage';

export function App() {
  return (
    <Routes>
      <Route index element={<NoBusiness />} />
      <Route path="politica-de-datos" element={<PolicyPage />} />
      <Route path=":slug" element={<BusinessPage />} />
      <Route path=":slug/ingresar" element={<LoginPage />} />
      <Route path=":slug/registro" element={<RegisterPage />} />
      <Route path=":slug/mis-reservas" element={<MyReservationsPage />} />
      <Route path="*" element={<NoBusiness />} />
    </Routes>
  );
}

function NoBusiness() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-md px-4 py-10">
        <Card>
          <h1 className="text-xl font-bold">Reserva tu cancha</h1>
          <p className="mt-2 text-sm text-fg-2">
            Abre el link de reservas que te compartió tu sede deportiva para ver sus canchas y horarios.
          </p>
        </Card>
      </main>
    </>
  );
}
