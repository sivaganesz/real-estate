/**
 * The same journeys against the dev server on 5174 (React dev-mode warnings then count as console problems).
 * Run with `pnpm e2e:dev`. Port 5174 belongs to the Parent / QA: stop any other dev server on it first.
 */
import { defineConfig } from '@playwright/test'
import base from './playwright.config.ts'

const PORT = 5174

export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
