import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { existsSync } from 'node:fs';

const names = ['core', 'angular', 'react', 'solid', 'svelte', 'vue', 'web-components', 'mcp-server'];
const head = '7d03457cb315d685835afcf2448e36524a7a2923';
const repo = 'Nacho-Labs-LLC/point-grab';
const api = `https://api.github.com/repos/${repo}`;
function tarball(manifest) {
  const content = Buffer.from(JSON.stringify(manifest));
  const header = Buffer.alloc(512);
  header.write('package/package.json');
  header.write('0000644\0', 100); header.write('0000000\0', 108); header.write('0000000\0', 116);
  header.write(`${content.length.toString(8).padStart(11, '0')}\0`, 124);
  header.write('00000000000\0', 136); header.fill(32, 148, 156); header.write('0', 156);
  header.write(`${header.reduce((a, b) => a + b, 0).toString(8).padStart(6, '0')}\0 `, 148);
  return gzipSync(Buffer.concat([header, content, Buffer.alloc((512 - content.length % 512) % 512), Buffer.alloc(1024)]));
}
function fixture() {
  const bytes = new Map(names.map(name => [name, tarball({ name: `@point-grab/${name}`, version: '0.2.0', dependencies: name === 'core' ? {} : { '@point-grab/core': '0.2.0' } })]));
  const artifacts = names.map(name => ({ name, sha256: createHash('sha256').update(bytes.get(name)).digest('hex') }));
  const present = new Set(names);
  const calls = [], publishes = [];
  const release = { id: 451652436, tag_name: 'v0.2.0', draft: false, prerelease: false, published_at: '2026-11-20T00:00:00Z', assets: artifacts.map(({ name, sha256 }) => ({ name: `point-grab-${name}-0.2.0.tgz`, digest: `sha256:${sha256}`, browser_download_url: `https://github.com/${repo}/releases/download/v0.2.0/point-grab-${name}-0.2.0.tgz` })) };
  const f = { bytes, artifacts, present, calls, publishes, release, latest: '0.2.0', ref: { object: { type: 'commit', sha: head } }, override: () => undefined };
  f.fetchImpl = async (input, options) => {
    const url = String(input); calls.push(url);
    const overridden = f.override(url, options); if (overridden) return overridden;
    if (url === `${api}/releases/451652436`) return Response.json(release);
    if (url === `${api}/git/ref/tags/v0.2.0`) return Response.json(f.ref);
    for (const name of names) {
      if (url === `https://github.com/${repo}/releases/download/v0.2.0/point-grab-${name}-0.2.0.tgz`) return new Response(bytes.get(name));
      if (url === `https://registry.npmjs.org/@point-grab%2f${name}/0.2.0`) return present.has(name) ? Response.json({ name: `@point-grab/${name}`, version: '0.2.0', dist: { tarball: `https://registry.npmjs.org/@point-grab/${name}/-/${name}-0.2.0.tgz` } }) : new Response('', { status: 404 });
      if (url === `https://registry.npmjs.org/@point-grab/${name}/-/${name}-0.2.0.tgz`) return new Response(bytes.get(name));
      if (url === `https://registry.npmjs.org/@point-grab%2f${name}/latest`) return Response.json({ version: f.latest });
    }
    throw new Error(`Unexpected test URL: ${url}`);
  };
  f.npmRunner = async (args, options) => {
    publishes.push({ args, options });
    const name = names.find(n => args[1].endsWith(`point-grab-${n}-0.2.0.tgz`));
    assert.ok(existsSync(args[1])); present.add(name);
  };
  return f;
}

test('matching published packages are all skipped after live preflight', async () => {
  const { runRecovery } = await load();
  const f = fixture();
  const result = await runRecovery({ ...f, check: true, env: process.env });
  assert.deepEqual(result.map(p => [p.name, p.action]), names.map(n => [`@point-grab/${n}`, 'skip']));
  assert.equal(f.publishes.length, 0);
  assert.ok(f.calls.includes(`${api}/releases/451652436`));
});

test('missing packages publish exact approved files sequentially with exact npm args and isolated config', async () => {
  const { runRecovery } = await load();
  const f = fixture(); for (const n of names) if (n !== 'solid') f.present.delete(n);
  const result = await runRecovery({ ...f, env: { ...process.env, NODE_AUTH_TOKEN: 'must-not-use', npm_config_registry: 'https://bad.invalid' }, sleep: async () => {} });
  assert.equal(result.filter(p => p.action === 'publish').length, 7);
  assert.deepEqual(f.publishes.map(p => p.args[1].split('/').at(-1)), names.filter(n => n !== 'solid').map(n => `point-grab-${n}-0.2.0.tgz`));
  for (const { args, options } of f.publishes) {
    assert.deepEqual(args, ['publish', args[1], '--provenance', '--access', 'public', '--registry', 'https://registry.npmjs.org']);
    assert.equal(options.env.NODE_AUTH_TOKEN, undefined);
    assert.equal(options.env.npm_config_registry, undefined);
    assert.equal(options.env.NPM_CONFIG_IGNORE_SCRIPTS, 'true');
    assert.ok(options.env.NPM_CONFIG_USERCONFIG.startsWith(options.cwd));
    assert.ok(!existsSync(args[1]), 'temporary files cleaned');
  }
});

test('main rejects wrong repo, event, operation, workflow and checkout before network', async () => {
  const { main } = await load();
  const valid = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: repo, GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_WORKFLOW_REF: `${repo}/.github/workflows/npm-publish.yml@refs/heads/main` };
  for (const change of [{ GITHUB_REPOSITORY: 'other/repo' }, { GITHUB_EVENT_NAME: 'push' }, { GITHUB_WORKFLOW_REF: `${repo}/.github/workflows/other.yml@main` }]) {
    await assert.rejects(main({ env: { ...valid, ...change }, readEvent: () => ({ inputs: { operation: 'recover-v0.2.0' } }), getHead: () => head }), /context|workflow|repository/i);
  }
  await assert.rejects(main({ env: valid, readEvent: () => ({ inputs: { operation: 'diagnose' } }), getHead: () => head }), /operation/i);
  await assert.rejects(main({ env: valid, readEvent: () => ({ inputs: { operation: 'recover-v0.2.0' } }), getHead: () => 'bad' }), /checkout/i);
});

const failureCases = [
  ['corrupt release bytes', f => { f.override = url => url.includes('/releases/download/') && url.endsWith('mcp-server-0.2.0.tgz') ? new Response('corrupt') : undefined; }, /SHA256 mismatch/],
  ['wrong release id', f => { f.release.id = 1; }, /approved published/],
  ['wrong release tag', f => { f.release.tag_name = 'v0.2.1'; }, /approved published/],
  ['draft release', f => { f.release.draft = true; }, /approved published/],
  ['prerelease', f => { f.release.prerelease = true; }, /approved published/],
  ['unpublished release', f => { f.release.published_at = null; }, /approved published/],
  ['wrong tag commit', f => { f.ref.object.sha = 'a'.repeat(40); }, /approved commit/],
  ['missing asset', f => { f.release.assets.pop(); }, /asset pin/],
  ['duplicate asset', f => { f.release.assets.push(f.release.assets.at(-1)); }, /asset pin/],
  ['wrong asset digest', f => { f.release.assets.at(-1).digest = `sha256:${'0'.repeat(64)}`; }, /asset pin/],
  ['wrong asset URL', f => { f.release.assets.at(-1).browser_download_url = 'https://evil.invalid/file'; }, /asset pin/],
  ['registry 500 is not absence', f => { f.override = url => url.endsWith('mcp-server/0.2.0') ? new Response('do-not-log', { status: 500 }) : undefined; }, /HTTP 500/],
  ['registry 403 is not absence', f => { f.override = url => url.endsWith('mcp-server/0.2.0') ? new Response('do-not-log', { status: 403 }) : undefined; }, /HTTP 403/],
  ['mismatched existing bytes', f => { f.override = url => url.includes('registry.npmjs.org') && url.endsWith('mcp-server-0.2.0.tgz') ? new Response('different') : undefined; }, /SHA256 mismatch/],
  ['unsafe existing URL', f => { f.override = url => url.endsWith('mcp-server/0.2.0') ? Response.json({ name: '@point-grab/mcp-server', version: '0.2.0', dist: { tarball: 'https://registry.npmjs.org/@point-grab/mcp-server/-/mcp-server-0.2.0.tgz?token=secret' } }) : undefined; }, /tarball URL/],
  ['wrong latest', f => { f.latest = '0.1.0'; }, /latest/],
  ['Solid missing', f => { f.present.delete('solid'); }, /Solid bootstrap/],
  ['network exception redacted', f => { f.override = () => { throw new Error('https://secret:password@evil.invalid/?token=private'); }; }, /raw details withheld/],
];
for (const [label, mutate, expected] of failureCases) {
  test(`preflight refuses ${label} with zero publishes`, async () => {
    const { runRecovery } = await load();
    const f = fixture(); f.present.delete('core'); mutate(f);
    await assert.rejects(runRecovery({ ...f, env: process.env }), expected);
    assert.equal(f.publishes.length, 0);
    assert.ok(!f.calls.some(url => url.includes('evil.invalid')));
  });
}
for (const [label, change, expected] of [
  ['name', { name: '@point-grab/wrong' }, /manifest identity/],
  ['version', { version: '0.2.1' }, /manifest identity/],
  ['dependency', { dependencies: { '@point-grab/core': '^0.2.0' } }, /Unpinned internal/],
  ['peer', { peerDependencies: { '@point-grab/core': 'workspace:*' } }, /Unpinned internal/],
]) {
  test(`tar manifest refuses wrong ${label} before publishing`, async () => {
    const { runRecovery } = await load();
    const f = fixture(); f.present.delete('core');
    const data = tarball({ name: '@point-grab/mcp-server', version: '0.2.0', ...change });
    f.bytes.set('mcp-server', data);
    const digest = createHash('sha256').update(data).digest('hex');
    f.artifacts.at(-1).sha256 = digest; f.release.assets.at(-1).digest = `sha256:${digest}`;
    await assert.rejects(runRecovery({ ...f, env: process.env }), expected);
    assert.equal(f.publishes.length, 0);
  });
}

test('check plans missing versions from 404 without publishing, while requiring matching Solid', async () => {
  const { runRecovery } = await load(); const f = fixture(); f.present.delete('core');
  const result = await runRecovery({ ...f, check: true });
  assert.equal(result[0].action, 'publish'); assert.equal(f.publishes.length, 0);
});

test('annotated release tag peels to approved commit', async () => {
  const { runRecovery } = await load(); const f = fixture();
  f.ref.object = { type: 'tag', sha: 'a'.repeat(40) };
  f.override = url => url === `${api}/git/tags/${'a'.repeat(40)}` ? Response.json({ object: { type: 'commit', sha: head } }) : undefined;
  await runRecovery({ ...f, check: true });
});

test('post-publish version, tarball and latest 404 retry with bounded delay, not publish retry', async () => {
  const { runRecovery } = await load(); const f = fixture(); f.present.delete('core');
  let sleeps = 0; const retried = new Set();
  f.override = url => {
    if (f.publishes.length && (url.endsWith('core/0.2.0') || url.endsWith('core-0.2.0.tgz') || url.endsWith('core/latest')) && !retried.has(url)) {
      retried.add(url); return new Response('', { status: 404 });
    }
  };
  await runRecovery({ ...f, sleep: async () => { sleeps++; } });
  assert.equal(sleeps, 3); assert.equal(f.publishes.length, 1);
});

test('post-publish 500 aborts immediately and never publishes later packages', async () => {
  const { runRecovery } = await load(); const f = fixture(); f.present.delete('core'); f.present.delete('angular');
  f.override = url => f.publishes.length && url.endsWith('core/0.2.0') ? new Response('', { status: 500 }) : undefined;
  await assert.rejects(runRecovery({ ...f, sleep: async () => assert.fail('500 must not retry') }), /HTTP 500/);
  assert.equal(f.publishes.length, 1);
});

test('persistent post-publish 404 stops after five reads without republishing', async () => {
  const { runRecovery } = await load(); const f = fixture(); f.present.delete('core');
  let reads = 0, sleeps = 0;
  f.override = url => { if (f.publishes.length && url.endsWith('core/0.2.0')) { reads++; return new Response('', { status: 404 }); } };
  await assert.rejects(runRecovery({ ...f, sleep: async () => { sleeps++; } }), /bounded verification/);
  assert.equal(reads, 5); assert.equal(sleeps, 4); assert.equal(f.publishes.length, 1);
});

test('final verification checks previously skipped packages again', async () => {
  const { runRecovery } = await load(); const f = fixture(); f.present.delete('core');
  f.override = url => f.publishes.length && url.endsWith('solid/latest') ? Response.json({ version: 'bad' }) : undefined;
  await assert.rejects(runRecovery({ ...f }), /latest/); assert.equal(f.publishes.length, 1);
});

test('check main bypasses local context but still performs live preflight', async () => {
  const { main } = await load(); let calls = 0;
  await assert.rejects(main({ args: ['--check'], env: process.env, readEvent: () => assert.fail('must not read event'), getHead: () => assert.fail('must not inspect checkout'), fetchImpl: async () => { calls++; return Response.json({ id: -1 }); } }), /approved published/);
  assert.equal(calls, 1);
});

test('HTTPS asset redirect chain is credential-free and host-allowlisted', async () => {
  const { request } = await load(); const calls = [];
  const response = await request(`https://github.com/${repo}/releases/download/v0.2.0/file.tgz`, { asset: true, fetchImpl: async (url, options) => {
    calls.push(String(url)); assert.equal(options.redirect, 'manual'); assert.equal(options.credentials, 'omit');
    assert.equal(options.headers.Authorization, undefined);
    return calls.length === 1 ? new Response(null, { status: 302, headers: { location: 'https://release-assets.githubusercontent.com/asset?signature=public-download' } }) : new Response('ok');
  } });
  assert.equal(await response.text(), 'ok'); assert.equal(calls.length, 2);
  for (const location of ['https://evil.invalid/secret', 'http://release-assets.githubusercontent.com/file', 'https://user:secret@release-assets.githubusercontent.com/file', 'https://release-assets.githubusercontent.com:444/file']) {
    let requests = 0;
    await assert.rejects(request(`https://github.com/${repo}/releases/download/v0.2.0/file.tgz`, { asset: true, fetchImpl: async () => { requests++; return new Response(null, { status: 302, headers: { location } }); } }), /raw details withheld/);
    assert.equal(requests, 1);
  }
});

test('registry redirects are never followed', async () => {
  const { runRecovery } = await load(); const f = fixture();
  f.override = url => url.endsWith('core/0.2.0') ? new Response(null, { status: 302, headers: { location: 'https://evil.invalid/secret' } }) : undefined;
  await assert.rejects(runRecovery({ ...f }), /HTTP 302/); assert.equal(f.publishes.length, 0);
  assert.ok(!f.calls.some(url => url.includes('evil.invalid')));
});

test('npm error output is withheld and temporary files are cleaned', async () => {
  const { runRecovery } = await load(); const f = fixture(); f.present.delete('core'); let directory;
  await assert.rejects(runRecovery({ ...f, npmRunner: async (_args, options) => { directory = options.cwd; throw new Error('npm_secret https://user:pass@private.invalid'); } }), error => {
    assert.equal(error.message, 'npm publish failed: @point-grab/core; raw details withheld'); return true;
  });
  assert.ok(directory); assert.equal(existsSync(directory), false);
});

test('no temp-directory fallback outside RUNNER_TEMP or TMPDIR', async () => {
  const { runRecovery } = await load();
  for (const env of [{}, { TMPDIR: 'relative' }]) await assert.rejects(runRecovery({ env, fetchImpl: () => assert.fail('must not request') }), /absolute directory/);
});

test('valid main context reaches pinned preflight without accepting artifact overrides', async () => {
  const { main } = await load(); let calls = 0;
  await assert.rejects(main({ env: { ...process.env, GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: repo, GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_WORKFLOW_REF: `${repo}/.github/workflows/npm-publish.yml@refs/heads/main` }, args: [], readEvent: () => ({ inputs: { operation: 'recover-v0.2.0' } }), getHead: () => head, artifacts: [], fetchImpl: async url => { calls++; assert.equal(String(url), `${api}/releases/451652436`); return Response.json({ id: -1 }); } }), /approved published/);
  assert.equal(calls, 1);
});

test('unknown CLI arguments never start network', async () => {
  const { main } = await load();
  await assert.rejects(main({ args: ['--publish'], fetchImpl: () => assert.fail('must not request') }), /Usage/);
});

const load = () => import('./recover-npm-v020.mjs');
test('local CLI refuses before network or npm', async () => {
  const { main } = await load();
  let requests = 0;
  await assert.rejects(main({ env: {}, args: [], fetchImpl: async () => { requests++; } }), /GitHub Actions/);
  assert.equal(requests, 0);
});
