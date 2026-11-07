#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
const all = ['vanilla', 'react', 'vue', 'angular', 'svelte', 'web-components', 'solid'];
const selected = process.argv.slice(2);
const frameworks = selected.length ? selected : all;
for (const framework of frameworks) if (!all.includes(framework)) throw new Error(`Unknown framework: ${framework}`);
for (const adapter of new Set(['core', 'mcp-server', ...frameworks.filter(f => f !== 'vanilla')])) {
  if (!existsSync(`packages/${adapter}/dist/index.js`)) throw new Error(`Missing built @point-grab/${adapter}. Run pnpm --filter './packages/**' --workspace-concurrency=1 run build first.`);
}
const results = [];
for (const framework of frameworks) {
  console.log(`\n=== Framework regression: ${framework} ===`);
  const start = Date.now();
  const result = spawnSync('pnpm', ['exec', 'playwright', 'test', '--config=playwright.framework-matrix.config.ts'], {
    stdio: 'inherit', env: { ...process.env, POINT_GRAB_FRAMEWORK: framework, NG_BUILD_MAX_WORKERS: '1' },
  });
  results.push({ framework, status: result.status === 0 ? 'passed' : 'failed', exitCode: result.status, error: result.error?.message, durationMs: Date.now() - start });
}
mkdirSync('test-results/framework-matrix', { recursive: true });
writeFileSync('test-results/framework-matrix/summary.json', JSON.stringify(results, null, 2) + '\n');
console.table(results);
process.exitCode = results.every(result => result.status === 'passed') ? 0 : 1;
