/**
 * M4 Appointments & Tasks e2e against the M4 dev server (5204) instead of the 5176 build + preview: use it while another module's
 * in-progress file breaks `pnpm build`. Start the server first (`pnpm exec vite --port 5204 --strictPort`), then
 * `pnpm exec playwright test -c e2e/m4-appointments-tasks.dev.config.ts --project=desktop` (or --project=phone).
 */
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from '@playwright/test'
import base from '../playwright.config.ts'

const PORT = 5204

export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: /m4-appointments-tasks\.spec\.ts$/,
  // outside test-results/: other agents' runs clear that folder mid-run
  outputDir: join(tmpdir(), 'crm-e2e-m4-appointments-tasks'),
  use: { ...base.use, baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    cwd: '..',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
