#!/usr/bin/env node
// Print a compact pass/fail summary (with first error line) from framework-matrix JSON reports.
import { readFileSync, existsSync } from 'node:fs';
const all = ['vanilla', 'react', 'vue', 'angular', 'svelte', 'web-components', 'solid'];
for (const fw of process.argv.slice(2).length ? process.argv.slice(2) : all) {
  const file = `test-results/framework-matrix/${fw}.json`;
  if (!existsSync(file)) { console.log(`${fw}: no report`); continue; }
  const report = JSON.parse(readFileSync(file, 'utf8'));
  const results = [];
  const walk = (suite) => { for (const s of suite.suites ?? []) walk(s); for (const spec of suite.specs ?? []) for (const t of spec.tests) results.push({ title: spec.title, file: spec.file, ok: t.results.at(-1)?.status === 'passed', error: t.results.at(-1)?.error?.message }); };
  for (const s of report.suites) walk(s);
  const failed = results.filter((r) => !r.ok);
  console.log(`${fw}: ${results.length - failed.length}/${results.length} passed`);
  for (const f of failed) console.log(`  ✘ [${f.file.replace(/.*\//, '')}] ${f.title}\n      ${(f.error ?? '').replace(/\u001b\[[0-9;]*m/g, '').split('\n').filter(Boolean).slice(0, 4).join(' | ').slice(0, 400)}`);
}
