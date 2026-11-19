import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';

const banner = { js: `/*!\n${readFileSync(new URL('./THIRD_PARTY_LICENSES.txt', import.meta.url), 'utf8')}\n*/` };

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
    banner,
    clean: false,
    minify: true,
    outExtension: () => ({ js: '.global.js' }),
  },
]);
