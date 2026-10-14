import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// El panel se sirve en /admin; en desarrollo, Vite reenvía /api a Nest.
// Se compila en public/admin: en Vercel lo sirve el CDN (public/** es estático) y
// en local lo sirve Nest con ServeStaticModule.
export default defineConfig({
  base: '/admin/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../public/admin',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
