import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Web de reservas para jugadores, servida en /reservar/<slug>. Se compila en
// public/reservar (igual que el panel en public/admin); en desarrollo, Vite
// reenvía /api a Nest.
export default defineConfig({
  base: '/reservar/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../public/reservar',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
