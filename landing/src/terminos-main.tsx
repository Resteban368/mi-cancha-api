import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { TerminosPage } from './pages/TerminosPage';
import './index.css';

const root = document.getElementById('root')!;
const page = (
  <StrictMode>
    <TerminosPage />
  </StrictMode>
);

// Igual que main.tsx: en producción el HTML viene prerenderizado.
if (root.hasChildNodes()) {
  hydrateRoot(root, page);
} else {
  createRoot(root).render(page);
}
