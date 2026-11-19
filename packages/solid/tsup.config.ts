import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', vite: 'src/vite.ts' },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['@point-grab/core', 'solid-js', 'vite'],
});
