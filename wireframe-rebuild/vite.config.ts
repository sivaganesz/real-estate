import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  // A fixed address for the demo. The browser keeps the demo data per address (port), so if the port changed between runs
  // (another app already on 5173 → Vite moves to 5174), edits seemed to vanish. strictPort stops instead of moving.
  server: { port: 5180, strictPort: true },
  preview: { port: 5181, strictPort: true },
})
