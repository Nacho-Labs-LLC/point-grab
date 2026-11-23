import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/npm-publish.yml', import.meta.url), 'utf8');

test('recovery requires an explicit version-specific operation, separate from default diagnostics', () => {
  assert.match(workflow, /default: diagnose/);
  assert.match(workflow, /- recover-v0\.2\.0/);
  const recovery = workflow.split('\n  recover:')[1]?.split('\n  diagnose:')[0];
  assert(recovery, 'missing narrowly scoped recovery job');
  assert.match(recovery, /if: github\.event_name == 'workflow_dispatch' && inputs\.operation == 'recover-v0\.2\.0'/);
  assert.match(recovery, /environment: npm-publish/);
  assert.match(recovery, /ref: 7d03457cb315d685835afcf2448e36524a7a2923/);
  assert.match(recovery, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(recovery, /persist-credentials: false/);
  assert.match(recovery, /node \.\.\/\.recovery-controller\/scripts\/recover-npm-v020\.mjs/);
  for (const command of ['pnpm run build', 'pnpm run test', 'pnpm run test:e2e', 'pnpm run verify:release']) {
    assert(recovery.includes(command), `missing release gate: ${command}`);
  }
  assert.doesNotMatch(recovery, /npm publish|NODE_AUTH_TOKEN|NPM_TOKEN|secrets\./);
  assert(recovery.indexOf('Preflight trusted publishing') < recovery.indexOf('pnpm install --frozen-lockfile'));
  assert.match(recovery, /if \(failed\) process\.exitCode = 1/);
  assert(recovery.includes("['core', 'angular', 'react', 'svelte', 'vue', 'web-components', 'mcp-server']"));
  const diagnostic = workflow.split('\n  diagnose:')[1];
  assert.match(diagnostic, /inputs\.operation == 'diagnose'/);
  assert.doesNotMatch(diagnostic, /recover-npm-v020/);
  assert.equal((workflow.match(/group: point-grab-npm-publish/g) || []).length, 2);
  assert.equal((workflow.match(/cancel-in-progress: false/g) || []).length, 2);
});
