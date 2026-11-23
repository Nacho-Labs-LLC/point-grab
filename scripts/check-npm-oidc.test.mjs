import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Synthetic protocol fixtures only: these are not live credentials or registry results.
const claims = { repository: 'Nacho-Labs-LLC/point-grab', ref: 'refs/heads/main', event_name: 'workflow_dispatch', aud: 'npm:registry.npmjs.org', unrelated: 'must-not-be-reported' };
const fakeIdToken = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.unit-signature`;
const fixtureEnv = {
  GITHUB_ACTIONS: 'true', ACTIONS_ID_TOKEN_REQUEST_URL: 'https://pipelines.actions.githubusercontent.com/idtoken?api-version=2.0',
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'unit-request-key',
};

test('refuses local execution before requesting credentials or making network calls', async () => {
  const { diagnoseNpmOidc } = await import('./check-npm-oidc.mjs');
  const result = await diagnoseNpmOidc({ env: {}, fetchImpl: () => { throw new Error('NETWORK ATTEMPTED'); } });
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'context');
});

test('exchanges the npm-audience token for core without publishing or exposing credentials', async () => {
  const { diagnoseNpmOidc } = await import('./check-npm-oidc.mjs');
  const requests = [], masks = [];
  const result = await diagnoseNpmOidc({ env: fixtureEnv, mask: (value) => masks.push(value), fetchImpl: async (url, options) => {
    requests.push({ url: String(url), options });
    if (requests.length === 1) {
      assert.equal(new URL(url).searchParams.get('audience'), 'npm:registry.npmjs.org');
      assert.equal(options.headers.Authorization, 'Bearer unit-request-key');
      return Response.json({ value: fakeIdToken });
    }
    assert.equal(String(url), 'https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/@point-grab%2fcore');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, `Bearer ${fakeIdToken}`);
    return Response.json({ token: 'unit-exchanged-credential' });
  } });
  assert.equal(result.ok, true);
  assert.equal(result.stage, 'exchange');
  assert.equal(result.status, 200);
  assert.equal(requests.length, 2);
  assert.equal(result.identity.repository, claims.repository);
  assert.equal(result.identity.ref, 'refs/heads/main');
  assert.equal(result.identity.unrelated, undefined);
  assert(masks.includes(fakeIdToken));
  assert(masks.includes('unit-exchanged-credential'));
  for (const secret of [...masks, claims.unrelated]) assert(!JSON.stringify(result).includes(secret));
  for (const { options } of requests) assert.equal(options.redirect, 'error');
});

test('fails closed for unsafe context, invalid responses and network failures without echoing exceptions', async (t) => {
  const { diagnoseNpmOidc } = await import('./check-npm-oidc.mjs');
  for (const url of ['https://attacker.invalid/idtoken', 'http://pipelines.actions.githubusercontent.com/idtoken', 'https://user:password@pipelines.actions.githubusercontent.com/idtoken']) {
    await t.test('rejects untrusted token request destination', async () => {
      const result = await diagnoseNpmOidc({ env: { ...fixtureEnv, ACTIONS_ID_TOKEN_REQUEST_URL: url }, fetchImpl: () => { throw new Error('NETWORK ATTEMPTED'); } });
      assert.equal(result.ok, false); assert.equal(result.stage, 'context');
    });
  }
  await t.test('refuses an unexpected token override rather than testing a different authentication path', async () => {
    const result = await diagnoseNpmOidc({ env: { ...fixtureEnv, NPM_ID_TOKEN: 'unit-override-key' }, fetchImpl: () => { throw new Error('NETWORK ATTEMPTED'); } });
    assert.equal(result.ok, false); assert.equal(result.stage, 'context');
    assert(!JSON.stringify(result).includes('unit-override-key'));
  });
  for (const response of [Response.json({ value: fakeIdToken }, { status: 403 }), Response.json({}), new Response('not JSON')]) {
    await t.test('does not exchange a failed or malformed GitHub token response', async () => {
      let calls = 0;
      const result = await diagnoseNpmOidc({ env: fixtureEnv, fetchImpl: async () => { calls++; return response; } });
      assert.equal(result.ok, false); assert.equal(result.stage, 'github-token'); assert.equal(calls, 1);
      assert(!JSON.stringify(result).includes(fakeIdToken));
    });
  }
  await t.test('does not treat a successful HTTP exchange without a credential as authorization', async () => {
    let calls = 0;
    const result = await diagnoseNpmOidc({ env: fixtureEnv, fetchImpl: async () => ++calls === 1 ? Response.json({ value: fakeIdToken }) : Response.json({}) });
    assert.equal(result.ok, false); assert.equal(result.stage, 'exchange');
  });
  await t.test('never returns a network exception containing a credential or URL', async () => {
    const result = await diagnoseNpmOidc({ env: fixtureEnv, fetchImpl: async () => { throw new Error(`failed ${fakeIdToken} https://private.invalid`); } });
    assert.equal(result.ok, false); assert.equal(result.stage, 'github-token');
    assert(!JSON.stringify(result).includes(fakeIdToken)); assert(!JSON.stringify(result).includes('private.invalid'));
  });
});

test('rejection diagnostics cannot expose credentials through other fields and preserve non-JSON status', async (t) => {
  const { diagnoseNpmOidc } = await import('./check-npm-oidc.mjs');
  for (const body of [
    { code: `npm_${'a'.repeat(36)}`, message: 'Rejected' },
    { token: 'unit-opaque-refused-credential', message: 'Rejected unit-opaque-refused-credential' },
  ]) {
    await t.test('withholds credentials from every emitted server-controlled field', async () => {
      const masks = []; let calls = 0;
      const result = await diagnoseNpmOidc({ env: fixtureEnv, mask: (value) => masks.push(value), fetchImpl: async () => ++calls === 1 ? Response.json({ value: fakeIdToken }) : Response.json(body, { status: 403 }) });
      assert.equal(result.ok, false);
      for (const value of [body.token, body.code].filter(Boolean)) assert(!JSON.stringify(result).includes(value));
      if (body.token) assert(masks.includes(body.token));
    });
  }
  await t.test('preserves registry HTTP status without logging a malformed body', async () => {
    let calls = 0;
    const result = await diagnoseNpmOidc({ env: fixtureEnv, fetchImpl: async () => ++calls === 1 ? Response.json({ value: fakeIdToken }) : new Response('private raw registry response', { status: 502 }) });
    assert.equal(result.ok, false); assert.equal(result.stage, 'exchange'); assert.equal(result.status, 502);
    assert(!JSON.stringify(result).includes('private raw registry response'));
  });
});

test('manual workflow dispatch is exchange-only and cannot enter the release publisher', () => {
  const workflow = readFileSync(new URL('../.github/workflows/npm-publish.yml', import.meta.url), 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  const [publisher, diagnostic] = workflow.split('\n  diagnose:');
  assert.match(publisher, /if: github\.event_name == 'release' && github\.event\.action == 'published'/);
  assert(diagnostic);
  assert.match(diagnostic, /if: github\.event_name == 'workflow_dispatch'/);
  assert.match(diagnostic, /environment: npm-publish/);
  assert.match(diagnostic, /node scripts\/check-npm-oidc\.mjs/);
  assert.doesNotMatch(diagnostic, /npm publish|provenance|upload-artifact/);
});

test('reports a bounded registry rejection while redacting credential echoes and control characters', async () => {
  const { diagnoseNpmOidc } = await import('./check-npm-oidc.mjs');
  let count = 0;
  const result = await diagnoseNpmOidc({ env: fixtureEnv, fetchImpl: async () => {
    if (++count === 1) return Response.json({ value: fakeIdToken });
    return Response.json({ code: 'E403', message: `trusted publisher mismatch\n${fakeIdToken} unit-request-key npm_unitOpaqueToken ${'x'.repeat(1000)}` }, { status: 403 });
  } });
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'exchange');
  assert.equal(result.status, 403);
  assert.equal(result.code, 'E403');
  assert.match(result.reason, /trusted publisher mismatch/);
  assert(result.reason.length <= 400);
  for (const secret of [fakeIdToken, 'unit-request-key', 'npm_unitOpaqueToken', '\n']) assert(!result.reason.includes(secret));
});
