/**
 * M8 Team & Settings e2e against the M8 dev server (5208) instead of the 5176 build + preview: use it while another
 * module's in-progress file breaks `pnpm build`, or 5176 is held by another run. Start the server first
 * (`pnpm exec vite --port 5208 --strictPort`), then `pnpm exec playwright test -c e2e/m8-team-settings.dev.config.ts --project=desktop`.
 */
import { defineConfig } from '@playwright/test'
import base from '../playwright.config.ts'

const PORT = 5208

export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: /m8-team-settings\.spec\.ts$/,
  outputDir: '../test-results/m8-team-settings',
  use: { ...base.use, baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    cwd: '..',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
