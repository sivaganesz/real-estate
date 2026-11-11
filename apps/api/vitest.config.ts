import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The first run downloads a MongoDB binary for the in-memory test database.
    hookTimeout: 180_000,
    testTimeout: 20_000,
  },
});
