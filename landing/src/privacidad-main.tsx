import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { PrivacidadPage } from './pages/PrivacidadPage';
import './index.css';

const root = document.getElementById('root')!;
const page = (
  <StrictMode>
    <PrivacidadPage />
  </StrictMode>
);

// Igual que main.tsx: en producción el HTML viene prerenderizado.
if (root.hasChildNodes()) {
  hydrateRoot(root, page);
} else {
  createRoot(root).render(page);
}
