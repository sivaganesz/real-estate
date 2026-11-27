/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Fixed ports: demo data lives in per-origin localStorage, so the port must never drift (strictPort stops instead of moving).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: { port: 5174, strictPort: true },
  preview: { port: 5175, strictPort: true },
  optimizeDeps: { exclude: ['tesseract.js'] },
  // The main chunk carries every locale and the demo seed (~180 kB gzip); heavy libraries (pdf.js, OCR, xlsx) are lazy.
  build: { chunkSizeWarningLimit: 900 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
