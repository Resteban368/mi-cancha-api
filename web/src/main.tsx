import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import './index.css';
import { SessionProvider } from './lib/session';
import { PlayerCouponsProvider } from './lib/couponsContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/reservar">
      <SessionProvider>
        <PlayerCouponsProvider>
          <App />
        </PlayerCouponsProvider>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
