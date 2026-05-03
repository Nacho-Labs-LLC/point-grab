import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
  },
  {
    entry: { index: 'src/index.global.ts' },
    outDir: 'dist',
    format: ['iife'],
    globalName: 'PointGrab',
    clean: false,
    minify: true,
    outExtension: () => ({ js: '.global.js' }),
  },
]);
