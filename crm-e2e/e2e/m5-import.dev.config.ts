/**
 * M5 Import & Extraction e2e against the M5 dev server (5205) instead of the 5176 build + preview: use it while another module's
 * in-progress file breaks `pnpm build`. Start the server first (`pnpm exec vite --port 5205 --strictPort`), then
 * `pnpm exec playwright test -c e2e/m5-import.dev.config.ts --project=desktop` (or --project=phone).
 */
import { defineConfig } from '@playwright/test'
import base from '../playwright.config.ts'

const PORT = 5205

export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: /m5-import.spec.ts$/,
  outputDir: '../test-results/m5-import',
  use: { ...base.use, baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    cwd: '..',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
