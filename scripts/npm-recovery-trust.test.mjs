import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseNpmOidc } from './check-npm-oidc.mjs';

const env = {
  GITHUB_ACTIONS: 'true',
  ACTIONS_ID_TOKEN_REQUEST_URL: 'https://pipelines.actions.githubusercontent.com/idtoken',
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'fixture-request',
};
const idToken = `header.${Buffer.from('{}').toString('base64url')}.signature`;

test('recovery can preflight each allowlisted package trust before publishing any artifact', async () => {
  for (const name of ['core', 'angular', 'react', 'solid', 'svelte', 'vue', 'web-components', 'mcp-server']) {
    let calls = 0;
    const result = await diagnoseNpmOidc({ env, packageName: `@point-grab/${name}`, fetchImpl: async (url) => {
      if (++calls === 1) return Response.json({ value: idToken });
      assert.equal(String(url), `https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/@point-grab%2f${name}`);
      return Response.json({ token: 'fixture-exchanged' }, { status: 201 });
    } });
    assert.equal(result.ok, true, `trust probe failed for ${name}`);
    assert.equal(result.package, `@point-grab/${name}`);
    assert.equal(calls, 2);
  }
});

test('unapproved package names are refused before network or token acquisition', async () => {
  for (const packageName of ['@other/core', '@point-grab/core/../../evil', 'https://evil.invalid', '', null]) {
    let calls = 0;
    const result = await diagnoseNpmOidc({ env, packageName, fetchImpl: async () => { calls++; throw new Error('network'); } });
    assert.equal(result.ok, false);
    assert.equal(result.stage, 'context');
    assert.equal(calls, 0);
  }
});
