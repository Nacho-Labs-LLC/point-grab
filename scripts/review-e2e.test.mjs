import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, mkdirSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { assertSafeOutput } from './review-e2e.mjs';
import { REVIEW_SUITES, runnerOutputDir } from './review-settings.cjs';
import { join, resolve, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const scratch = () => mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), 'point-grab-review-unit-'));
// A child with all process launching disabled: unsafe paths must fail BEFORE any spawn.
function rejectOutput(output, env = {}) {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import cp from 'node:child_process';
    import fs from 'node:fs';
    import { syncBuiltinESMExports } from 'node:module';
    fs.mkdirSync = () => { throw new Error('CREATION ATTEMPTED'); };
    cp.spawn = cp.spawnSync = () => { throw new Error('SPAWN ATTEMPTED'); };
    syncBuiltinESMExports();
    const { main } = await import('./scripts/review-e2e.mjs');
    try { await main(['--output', process.env.UNIT_OUTPUT]); process.exitCode = 2; }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  `], { cwd: root, env: { ...process.env, ...env, UNIT_OUTPUT: output }, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /overlap/i);
  assert.doesNotMatch(result.stderr, /SPAWN ATTEMPTED/);
  assert.equal(existsSync(output), false, 'no output created');
}

test('default sibling output remains usable without creating it', () => {
  const output = join(root, 'test-results', `review-unit-safe-${process.pid}`);
  assert.doesNotThrow(() => assertSafeOutput(output, {}));
  assert.equal(existsSync(output), false);
});

const require = createRequire(import.meta.url);
const cli = require.resolve('@playwright/test/cli');
function list(config, env = {}, reporter = 'json') {
  return spawnSync(process.execPath, [cli, 'test', `--config=${config}`, '--list', `--reporter=${reporter}`], {
    cwd: root, encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 8 * 1024 * 1024,
  });
}

test('all real configs load in normal and evidence mode with identical inventory and protected roots', () => {
  for (const suite of REVIEW_SUITES) {
    const extra = suite.framework ? { POINT_GRAB_FRAMEWORK: suite.framework } : {};
    const normal = list(suite.config, { ...extra, POINT_GRAB_EVIDENCE_DIR: '' });
    const evidence = list(suite.config, { ...extra, POINT_GRAB_EVIDENCE_DIR: join(scratch(), 'evidence') });
    assert.equal(normal.status, 0, normal.stderr);
    assert.equal(evidence.status, 0, evidence.stderr);
    const a = JSON.parse(normal.stdout), b = JSON.parse(evidence.stdout);
    assert.deepEqual(a.suites, b.suites, suite.name);
    assert.equal(a.config.forbidOnly, false);
    assert.equal(b.config.forbidOnly, true);
    for (const project of b.config.projects) assert.equal(project.outputDir, runnerOutputDir(suite.name));
    const output = join(scratch(), 'inventory');
    const discovered = list(suite.config, { ...extra, POINT_GRAB_EVIDENCE_DIR: output, POINT_GRAB_INVENTORY_SUITE: suite.name }, join(root, 'scripts/inventory-reporter.mjs'));
    assert.equal(discovered.status, 0, discovered.stderr);
    const inventory = JSON.parse(readFileSync(join(output, suite.name, 'inventory.json'), 'utf8'));
    assert.equal(inventory.forbidOnly, true);
    assert.equal(inventory.completed, true);
    assert.equal(inventory.status, 'passed');
    assert.deepEqual(inventory.errors, []);
    assert.ok(inventory.tests.length > 0);
    assert.equal(new Set(inventory.tests.map(t => t.id)).size, inventory.tests.length);
  }
});

test('every recording config fails closed on actual focused test discovery', () => {
  for (const suite of REVIEW_SUITES.filter(s => !s.framework || s.framework === 'vanilla')) {
    const dir = scratch();
    const testModule = pathToFileURL(require.resolve('@playwright/test')).href;
    writeFileSync(join(dir, 'focused.spec.mjs'), `import playwright from ${JSON.stringify(testModule)}; const { test } = playwright; test.only('focused', () => {}); test('omitted', () => {});`);
    const config = join(dir, 'playwright.config.mts');
    writeFileSync(config, `import original from ${JSON.stringify(pathToFileURL(join(root, suite.config)).href)};
      const config = original.default ?? original;
      export default { ...config, testDir: ${JSON.stringify(dir)}, testMatch: '*.spec.mjs', projects: undefined };`);
    const output = join(dir, 'evidence');
    const result = list(config, { POINT_GRAB_EVIDENCE_DIR: output, POINT_GRAB_INVENTORY_SUITE: suite.name }, join(root, 'scripts/inventory-reporter.mjs'));
    assert.equal(result.status, 1, `${suite.name}: ${result.stderr}`);
    const inventory = JSON.parse(readFileSync(join(output, suite.name, 'inventory.json'), 'utf8'));
    assert.equal(inventory.status, 'failed');
    assert.ok(inventory.errors.some(e => e.message.includes("'.only'") && e.message.includes('forbidOnly')), JSON.stringify(inventory.errors));
  }
});

test('rejects normalized descendants of every runner output before creation or spawn', () => {
  const roots = ['site', 'page-capture', 'freeze', 'solid-demo', 'screen-grab',
    ...['vanilla', 'react', 'vue', 'angular', 'svelte', 'web-components', 'solid'].map(f => `framework-matrix/${f}`)];
  for (const runner of roots) {
    const parent = join(root, 'test-results', runner, `unit-unsafe-${process.pid}`);
    rejectOutput(`${parent}/unused/../review`);
    assert.equal(existsSync(parent), false, 'not even parent directories created');
  }
});

test('rejects SOLID_TEST_OUTPUT overlap in both directions and through symlink ancestry', () => {
  const dir = scratch();
  const actual = join(dir, 'actual');
  mkdirSync(actual);
  symlinkSync(actual, join(dir, 'alias'));
  rejectOutput(join(dir, 'alias', 'new', 'review'), { SOLID_TEST_OUTPUT: actual });
  assert.equal(existsSync(join(actual, 'new')), false);
  rejectOutput(join(dir, 'new-review'), { SOLID_TEST_OUTPUT: join(dir, 'new-review', 'runner') });
  rejectOutput(join(dir, 'relative-solid', 'new'), { SOLID_TEST_OUTPUT: relative(join(root, 'examples/solid'), join(dir, 'relative-solid')) });
});
