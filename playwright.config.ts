import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end journeys against the real app. The API runs on a fresh
 * in-memory database with demo data, in offline AI mode, on its own ports,
 * so a running dev server is never touched.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5190', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] }, grep: /@phone/ },
  ],
  webServer: [
    {
      command: 'pnpm --filter @estate/api start',
      url: 'http://localhost:4190/api/health',
      env: { PORT: '4190', EPHEMERAL_DB: '1', GEMINI_API_KEY: '' },
      timeout: 180_000,
      reuseExistingServer: false,
    },
    {
      command: 'pnpm --filter @estate/web dev',
      url: 'http://localhost:5190',
      env: { API_URL: 'http://localhost:4190', WEB_PORT: '5190', VITE_CACHE_DIR: 'node_modules/.vite-e2e' },
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
