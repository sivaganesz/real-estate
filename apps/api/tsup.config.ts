import { defineConfig } from 'tsup';

// Builds the API for production (`pnpm build` → `pnpm start`). The shared workspace
// package is TypeScript source, so it is bundled in; npm dependencies stay external.
export default defineConfig({
  entry: ['src/server.ts', 'src/db/seed.cli.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  noExternal: ['@real-estate/shared'],
});
