import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const api = process.env.API_URL ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: {
      '/api': api,
      '/uploads': api,
    },
  },
});
