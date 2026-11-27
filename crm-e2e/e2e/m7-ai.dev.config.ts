/**
 * M7 AI Assistants e2e against the M7 dev server (5207) instead of the 5176 build + preview: use it while another
 * agent's run holds 5176 or another module's in-progress file breaks `pnpm build`.
 * `pnpm exec playwright test -c e2e/m7-ai.dev.config.ts --project=desktop` (or --project=phone); it starts
 * `vite --port 5207 --strictPort` itself, or reuses one that is already running.
 */
import { defineConfig } from '@playwright/test'
import base from '../playwright.config.ts'

const PORT = 5207

export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: /m7-ai\.spec\.ts$/,
  outputDir: '../test-results/m7-ai',
  use: { ...base.use, baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    cwd: '..',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
