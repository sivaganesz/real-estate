import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const api = process.env.API_URL ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  // The e2e server gets its own cache so it can run next to a normal dev server.
  cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite',
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: {
      '/api': api,
      '/uploads': api,
    },
  },
});
