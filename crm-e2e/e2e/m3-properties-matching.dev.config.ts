/**
 * M3 Properties & Matching e2e against the M3 dev server (5203) instead of the 5176 build + preview: use it while another module's
 * in-progress file breaks `pnpm build`. Start the server first (`pnpm exec vite --port 5203 --strictPort`), then
 * `pnpm exec playwright test -c e2e/m3-properties-matching.dev.config.ts --project=desktop` (or --project=phone).
 */
import { defineConfig } from '@playwright/test'
import base from '../playwright.config.ts'

const PORT = 5203

export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: /m3-properties-matching\.spec\.ts$/,
  outputDir: '../test-results/m3-properties-matching',
  // another agent's run may wipe test-results/ mid-run: no trace files to lose
  use: { ...base.use, baseURL: `http://localhost:${PORT}`, trace: 'off' },
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    cwd: '..',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
