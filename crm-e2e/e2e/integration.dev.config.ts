/**
 * The integration journeys against a dev server (default 5210) instead of the 5176 build + preview. Start the server
 * first (`pnpm exec vite --port 5210 --strictPort`), then `pnpm exec playwright test -c e2e/integration.dev.config.ts`.
 */
import { defineConfig } from '@playwright/test'
import base from '../playwright.config.ts'

const PORT = Number(process.env.PW_PORT ?? 5210)

export default defineConfig({
  ...base,
  testDir: '.',
  outputDir: '../test-results/integration',
  use: { ...base.use, baseURL: `http://localhost:${PORT}` },
  webServer: { command: `pnpm exec vite --port ${PORT} --strictPort`, cwd: '..', url: `http://localhost:${PORT}`, reuseExistingServer: true, timeout: 120_000 },
})
