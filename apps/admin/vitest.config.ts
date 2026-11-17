import { mergeConfig } from 'vite';
import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
      // Click-through tests take a few seconds when every package's tests run at once
      // (the API suite starts in-memory databases in parallel). Same limit as the API suite.
      testTimeout: 20_000,
    },
  }),
);
