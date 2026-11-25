import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const api = process.env.API_URL ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  // The e2e server gets its own cache so it can run next to a normal dev server.
  cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite',
  build: {
    rollupOptions: {
      output: {
        // Libraries change less often than our code: a separate file stays cached between releases.
        manualChunks: { vendor: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'] },
      },
    },
  },
  server: {
    // Pages load lazily; preparing them at startup keeps the first click on each one quick.
    warmup: { clientFiles: ['./src/main.tsx', './src/pages/*.tsx'] },
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: {
      '/api': api,
      '/uploads': api,
    },
  },
});
