/**
 * M2 Leads & Clients e2e against the M2 dev server (5202) instead of the 5176 build + preview: use it while another module's
 * in-progress file breaks `pnpm build`. Start the server first (`pnpm exec vite --port 5202 --strictPort`), then
 * `pnpm exec playwright test -c e2e/m2-leads-clients.dev.config.ts --project=desktop` (or --project=phone).
 */
import { defineConfig } from '@playwright/test'
import base from '../playwright.config.ts'

const PORT = 5202

export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: /m2-leads-clients\.spec\.ts$/,
  outputDir: '../test-results/m2-leads-clients',
  use: { ...base.use, baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    cwd: '..',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
