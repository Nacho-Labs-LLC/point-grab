import { pathToFileURL } from 'node:url';

export async function diagnoseNpmOidc({ env = process.env, fetchImpl = fetch, mask = () => {}, packageName = '@point-grab/core' } = {}) {
  const packages = ['core', 'angular', 'react', 'solid', 'svelte', 'vue', 'web-components', 'mcp-server'].map((name) => `@point-grab/${name}`);
  if (!packages.includes(packageName)) return { ok: false, stage: 'context', reason: 'Unapproved package name' };
  if (env.GITHUB_ACTIONS !== 'true') return { ok: false, stage: 'context' };
  if (env.NPM_ID_TOKEN) return { ok: false, stage: 'context', reason: 'Unexpected NPM_ID_TOKEN override; diagnostic would not match the npm CLI token path' };
  const requestToken = env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!env.ACTIONS_ID_TOKEN_REQUEST_URL || !requestToken) return { ok: false, stage: 'github-token' };
  let stage = 'context';
  let identity;
  let status;
  try {
    const url = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.actions.githubusercontent.com') || url.port || url.username || url.password) {
      return { ok: false, stage, reason: 'Unexpected GitHub token endpoint' };
    }
    mask(requestToken);
    stage = 'github-token';
    url.searchParams.append('audience', 'npm:registry.npmjs.org');
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${requestToken}` },
      redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    status = response.status;
    if (!response.ok) return { ok: false, stage, status: response.status, reason: 'GitHub token request rejected' };
    const idToken = (await response.json()).value;
    if (typeof idToken !== 'string' || !idToken) return { ok: false, stage, reason: 'GitHub token response missing credential' };
    mask(idToken);
    // These claims are diagnostic metadata, not locally verified authorization.
    // The registry verifies the issued token during the exchange below.
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));
    identity = {};
    for (const key of ['repository', 'repository_id', 'repository_owner', 'repository_owner_id', 'workflow_ref', 'job_workflow_ref', 'ref', 'environment', 'event_name', 'aud', 'sub']) {
      if (typeof payload?.[key] === 'string') identity[key] = payload[key].slice(0, 400);
    }
    stage = 'exchange';
    status = undefined;
    const exchange = await fetchImpl(`https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/${packageName.replace('/', '%2f')}`, {
      method: 'POST', headers: { Accept: 'application/json', Authorization: `Bearer ${idToken}` },
      redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    status = exchange.status;
    const exchanged = await exchange.json();
    const credentials = [requestToken, idToken];
    for (const field of ['token', 'access_token', 'id_token', 'refresh_token']) {
      if (typeof exchanged?.[field] === 'string' && exchanged[field]) {
        credentials.push(exchanged[field]);
        mask(exchanged[field]);
      }
    }
    if (!exchange.ok) {
      let reason = typeof exchanged?.message === 'string' ? exchanged.message : 'Registry rejected token exchange';
      for (const secret of credentials) reason = reason.replaceAll(secret, '[redacted]');
      reason = reason.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted]')
        .replace(/\bnpm_[A-Za-z0-9]+\b/g, '[redacted]').replace(/https?:\/\/\S+/g, '[url]')
        .replace(/[\x00-\x20\x7f]+/g, ' ').slice(0, 400);
      const recognizedCodes = ['E400', 'E401', 'E403', 'E404', 'E409', 'E422', 'E429', 'E500', 'E502', 'E503', 'E504', 'EAUTH', 'ENEEDAUTH', 'EOIDC'];
      const code = recognizedCodes.includes(exchanged?.code) && !credentials.includes(exchanged.code) ? exchanged.code : 'unreported';
      return { ok: false, stage, status: exchange.status, code, reason, package: packageName, identity };
    }
    if (typeof exchanged?.token !== 'string' || !exchanged.token) return { ok: false, stage, status: exchange.status, reason: 'Registry exchange response missing credential', identity };
    return { ok: true, stage, status: exchange.status, package: packageName, identity };
  } catch {
    // Never return exception text: fetch/parser errors can contain URLs or credentials.
    return { ok: false, stage, status, reason: 'Request or response processing failed; raw details withheld', identity };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await diagnoseNpmOidc({ mask: (value) => console.log(`::add-mask::${value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`) });
  console.log(JSON.stringify(result));
  process.exitCode = result.ok ? 0 : 1;
}
