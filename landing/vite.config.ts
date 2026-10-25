import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Landing pública de Mi Cancha (dueños de cancha y jugadores). Se compila en la
// raíz de public/ para que Vercel sirva "/" desde el CDN. emptyOutDir va en false
// para no borrar public/admin ni public/reservar, que comparten la carpeta.
export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../public',
    emptyOutDir: false,
  },
  server: {
    port: 5175,
  },
});
