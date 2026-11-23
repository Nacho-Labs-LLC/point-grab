import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const REPOSITORY = 'Nacho-Labs-LLC/point-grab';
export const COMMIT = '7d03457cb315d685835afcf2448e36524a7a2923';
const API = `https://api.github.com/repos/${REPOSITORY}`;
const REGISTRY = 'https://registry.npmjs.org';
export const ARTIFACTS = Object.freeze([
  ['core', '820fccd29dfe40167e8c659b2839cd0c1fa34060bfb4cff6886fa9dd37adc207'],
  ['angular', '6fe49558c72dfa9501f826c0534040c87aeb06b7bbd245e227de8648898ce0a9'],
  ['react', '415d15544b20875cd740f03431413f3044bc987e883fcf8679861082dc2f55d1'],
  ['solid', '384131106f8dc2b3017a8ea8c574384323982b4f685d9a3c1c4e0b91428da4ba'],
  ['svelte', '82bee0ac98f8bb507f7fbfe412f1cdf2e9b6b2b895e45fe77a83da454b884023'],
  ['vue', 'c09bd8645184a2578a7baa84b5665b37720340ac28b101e7d0d893d1a2252a80'],
  ['web-components', 'a3fd8cd9570965e13c2acad01d898e438ee5ed1eb5514ee65621879b3d67dbc9'],
  ['mcp-server', 'd1012d85e9af91db2e2d77cd9417ba0456ce2f7833928de8dd5f6640a7066e21'],
].map(([name, sha256]) => Object.freeze({ name, sha256 })));
const filename = name => `point-grab-${name}-0.2.0.tgz`;
const assetURL = name => `https://github.com/${REPOSITORY}/releases/download/v0.2.0/${filename(name)}`;
const registryURL = name => `${REGISTRY}/@point-grab%2f${name}`;
const tarballURL = name => `${REGISTRY}/@point-grab/${name}/-/${name}-0.2.0.tgz`;
const fail = message => { throw new Error(message); };

// No credentials or user-controlled headers; redirects are followed manually.
export async function request(url, { fetchImpl = fetch, asset = false } = {}) {
  try {
    for (let hop = 0; hop < 6; hop++) {
      const parsed = new URL(url);
      const hosts = asset ? ['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'] : ['api.github.com', 'registry.npmjs.org'];
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || !hosts.includes(parsed.hostname)) fail('Unexpected download destination');
      const response = await fetchImpl(url, { method: 'GET', redirect: 'manual', credentials: 'omit', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
      if (asset && [301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) fail('Missing redirect destination');
        url = new URL(location, url).href;
        continue;
      }
      return response;
    }
  } catch {
    fail('Public HTTPS request failed; raw details withheld');
  }
  fail('Public HTTPS redirect limit exceeded');
}
async function json(url, fetchImpl, absent = false) {
  const response = await request(url, { fetchImpl });
  if (absent && response.status === 404) return null;
  if (response.status !== 200) fail(`Public metadata request rejected (HTTP ${response.status})`);
  try { return await response.json(); } catch { fail('Invalid public metadata response'); }
}
async function bytes(url, fetchImpl, asset = false, absent = false) {
  const response = await request(url, { fetchImpl, asset });
  if (absent && response.status === 404) return null;
  if (response.status !== 200) fail(`Public tarball request rejected (HTTP ${response.status})`);
  try { return Buffer.from(await response.arrayBuffer()); } catch { fail('Invalid public tarball response'); }
}
function verifyHash(data, artifact) {
  if (createHash('sha256').update(data).digest('hex') !== artifact.sha256) fail(`SHA256 mismatch: @point-grab/${artifact.name}`);
}
function manifest(file, name) {
  let value;
  try {
    value = JSON.parse(execFileSync('tar', ['-xOf', file, 'package/package.json'], { encoding: 'utf8', stdio: 'pipe', timeout: 30000, maxBuffer: 1024 * 1024 }));
  } catch { fail(`Invalid tar manifest: @point-grab/${name}`); }
  if (value.name !== `@point-grab/${name}` || value.version !== '0.2.0') fail(`Wrong manifest identity: @point-grab/${name}`);
  for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies']) {
    for (const [dependency, version] of Object.entries(value[section] ?? {})) {
      if (dependency.startsWith('@point-grab/') && version !== '0.2.0') fail(`Unpinned internal dependency: @point-grab/${name}`);
    }
  }
}
async function verifyTag(fetchImpl) {
  let object = (await json(`${API}/git/ref/tags/v0.2.0`, fetchImpl)).object;
  for (let i = 0; i < 5 && object?.type === 'tag'; i++) {
    if (!/^[a-f0-9]{40}$/.test(object.sha)) fail('Invalid release tag');
    object = (await json(`${API}/git/tags/${object.sha}`, fetchImpl)).object;
  }
  if (object?.type !== 'commit' || object.sha !== COMMIT) fail('Release tag does not match approved commit');
}
async function registryState(artifact, fetchImpl, eventual = false) {
  const value = await json(`${registryURL(artifact.name)}/0.2.0`, fetchImpl, true);
  if (value === null) return false;
  if (value.name !== `@point-grab/${artifact.name}` || value.version !== '0.2.0' || value.dist?.tarball !== tarballURL(artifact.name)) fail(`Unexpected registry identity or tarball URL: @point-grab/${artifact.name}`);
  const data = await bytes(tarballURL(artifact.name), fetchImpl, false, eventual);
  if (data === null) return false;
  verifyHash(data, artifact);
  const latest = await json(`${registryURL(artifact.name)}/latest`, fetchImpl, eventual);
  if (latest === null) return false;
  if (latest.version !== '0.2.0') fail(`Registry latest is not 0.2.0: @point-grab/${artifact.name}`);
  return true;
}

// artifacts is injectable only for offline fixtures; main always uses immutable ARTIFACTS.
export async function runRecovery({ fetchImpl = fetch, artifacts = ARTIFACTS, check = false, env = process.env, npmRunner = defaultNpmRunner, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const base = env.RUNNER_TEMP || env.TMPDIR;
  if (!base || !path.isAbsolute(base)) fail('RUNNER_TEMP or TMPDIR must be an absolute directory');
  const dir = mkdtempSync(path.join(base, 'point-grab-recover-v020-'));
  try {
    const release = await json(`${API}/releases/451652436`, fetchImpl);
    if (release.id !== 451652436 || release.tag_name !== 'v0.2.0' || release.draft !== false || release.prerelease !== false || !release.published_at) fail('Release is not the approved published v0.2.0 release');
    await verifyTag(fetchImpl);
    const plan = [];
    for (const artifact of artifacts) {
      const assets = release.assets?.filter(a => a.name === filename(artifact.name));
      if (assets?.length !== 1 || assets[0].digest !== `sha256:${artifact.sha256}` || assets[0].browser_download_url !== assetURL(artifact.name)) fail(`Release asset pin mismatch: @point-grab/${artifact.name}`);
      const data = await bytes(assetURL(artifact.name), fetchImpl, true);
      verifyHash(data, artifact);
      const file = path.join(dir, filename(artifact.name));
      writeFileSync(file, data, { flag: 'wx', mode: 0o600 });
      manifest(file, artifact.name);
      const present = await registryState(artifact, fetchImpl);
      if (artifact.name === 'solid' && !present) fail('Solid bootstrap must already exist and match');
      plan.push({ name: `@point-grab/${artifact.name}`, action: present ? 'skip' : 'publish', file });
    }
    if (!check) {
      // Isolate npm configuration and lifecycle scripts while preserving Actions
      // OIDC variables. Never read user/global/local token configuration.
      const npmEnv = Object.fromEntries(Object.entries(env).filter(([key]) => !/^npm_config_/i.test(key) && !/^(NODE_AUTH_TOKEN|NPM_TOKEN|NPM_ID_TOKEN)$/i.test(key)));
      const userconfig = path.join(dir, 'npm-userconfig');
      const globalconfig = path.join(dir, 'npm-globalconfig');
      writeFileSync(userconfig, '', { mode: 0o600 }); writeFileSync(globalconfig, '', { mode: 0o600 });
      Object.assign(npmEnv, { NPM_CONFIG_USERCONFIG: userconfig, NPM_CONFIG_GLOBALCONFIG: globalconfig, NPM_CONFIG_IGNORE_SCRIPTS: 'true' });
      for (let i = 0; i < plan.length; i++) {
        if (plan[i].action === 'skip') continue;
        try {
          await npmRunner(['publish', plan[i].file, '--provenance', '--access', 'public', '--registry', REGISTRY], { cwd: dir, env: npmEnv });
        } catch { fail(`npm publish failed: ${plan[i].name}; raw details withheld`); }
        await verifyVisible(artifacts[i], fetchImpl, sleep);
      }
      for (const artifact of artifacts) await verifyVisible(artifact, fetchImpl, sleep);
    }
    return plan.map(({ name, action }) => ({ name, action }));
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

function defaultNpmRunner(args, options) {
  execFileSync('npm', args, { ...options, stdio: 'pipe', timeout: 180000, maxBuffer: 1024 * 1024 });
}
async function verifyVisible(artifact, fetchImpl, sleep) {
  for (let attempt = 0; attempt < 5; attempt++) {
    if (await registryState(artifact, fetchImpl, true)) return;
    if (attempt < 4) await sleep(2000);
  }
  fail(`Registry version still absent after bounded verification: @point-grab/${artifact.name}`);
}

export async function main({ env = process.env, args = process.argv.slice(2), fetchImpl = fetch, readEvent = () => JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8')), getHead = () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: 'pipe' }).trim(), log = console.log } = {}) {
  if (args.some(arg => arg !== '--check') || args.length > 1) fail('Usage: recover-npm-v020.mjs [--check]');
  const check = args.includes('--check');
  if (!check) {
    if (env.GITHUB_ACTIONS !== 'true') fail('Recovery requires GitHub Actions');
    if (env.GITHUB_REPOSITORY !== REPOSITORY || env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || !env.GITHUB_WORKFLOW_REF?.startsWith(`${REPOSITORY}/.github/workflows/npm-publish.yml@`)) fail('Recovery requires the approved repository and workflow context');
    let event, head;
    try { event = readEvent(); } catch { fail('Cannot read dispatch operation'); }
    if (event?.inputs?.operation !== 'recover-v0.2.0') fail('Recovery requires explicit recover-v0.2.0 operation');
    try { head = getHead(); } catch { fail('Cannot verify tag checkout'); }
    if (head !== COMMIT) fail('Recovery checkout is not the approved commit');
  }
  const plan = await runRecovery({ env, fetchImpl, check });
  for (const item of plan) log(`${item.name}@0.2.0: ${item.action}`);
  return plan;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
