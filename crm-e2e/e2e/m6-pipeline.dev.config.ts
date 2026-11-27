/**
 * M6 Pipeline e2e against the M6 dev server (5206) instead of the 5176 build + preview: use it while another module's
 * in-progress file breaks `pnpm build`. Start the server first (`pnpm exec vite --port 5206 --strictPort`), then
 * `pnpm exec playwright test -c e2e/m6-pipeline.dev.config.ts --project=desktop` (or --project=phone).
 */
import { defineConfig } from '@playwright/test'
import base from '../playwright.config.ts'

const PORT = 5206

export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: /m6-pipeline\.spec\.ts$/,
  outputDir: '../test-results/m6-pipeline',
  use: { ...base.use, baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    cwd: '..',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
