#!/usr/bin/env node
// Every browser suite, in sequence (each starts its own server). Stops at the first failure.
import { spawnSync } from 'node:child_process';

const suites = [
  ['Site live demo', ['pnpm', 'exec', 'playwright', 'test']],
  ['Seven framework demos (contract + demo specs)', ['node', 'scripts/verify-framework-matrix.mjs']],
  ['Page capture', ['pnpm', 'exec', 'playwright', 'test', '--config=playwright.page-capture.config.ts']],
  ['Freeze lifecycle', ['pnpm', 'exec', 'playwright', 'test', '--config=playwright.freeze.config.ts']],
  ['Solid storefront', ['pnpm', 'exec', 'playwright', 'test', '--config=examples/solid/playwright.config.ts']],
];
for (const [name, [command, ...args]] of suites) {
  console.log(`\n### ${name}`);
  const { status } = spawnSync(command, args, { stdio: 'inherit' });
  if (status !== 0) { console.error(`\n${name} failed (exit ${status}).`); process.exit(status ?? 1); }
}
