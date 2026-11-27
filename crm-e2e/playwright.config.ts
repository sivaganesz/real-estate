/**
 * Playwright (adapted from origin/feat/estate-platform): a single static app served by `vite preview` on 5176,
 * Edge channel (installed on the demo machine, no browser download), desktop / tablet / phone projects.
 * Tests start from empty localStorage unless tagged @persist (see e2e/fixtures.ts).
 */
import { defineConfig, devices } from '@playwright/test'

const PORT = 5176

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Edge is installed on the demo machine (no browser download). Fallback: PW_CHANNEL=chrome pnpm e2e
    channel: process.env.PW_CHANNEL ?? 'msedge',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `pnpm build && pnpm exec vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } }, grepInvert: /@phone|@tablet/ },
    { name: 'tablet', use: { viewport: devices['iPad (gen 7)'].viewport, userAgent: devices['iPad (gen 7)'].userAgent }, grep: /@tablet/ },
    { name: 'phone', use: { viewport: devices['Pixel 7'].viewport, userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true }, grep: /@phone/ },
  ],
})
