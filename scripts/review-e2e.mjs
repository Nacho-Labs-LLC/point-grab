#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, createWriteStream, existsSync, readdirSync, realpathSync } from 'node:fs';
import { resolve, join, dirname, isAbsolute, delimiter, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { FRAMEWORKS, REVIEW_SUITES, runnerOutputDir } from './review-settings.cjs';
export { FRAMEWORKS };
export const EXPECTED_SUITES = ['site', ...FRAMEWORKS.map(f => `framework-${f}`), 'page-capture', 'freeze', 'solid-storefront'];
export const REQUIRED_DEMO_JOURNEYS = JSON.parse(readFileSync(new URL('./review-demo-journeys.json', import.meta.url), 'utf8'));
export const REQUIRED_COVERAGE = Object.fromEntries(FRAMEWORKS.map(framework => [
  `framework-${framework}`, [
    'copy-element', 'copy-html', 'copy-styles', 'comments-cancel', 'comments-single', 'comments-multiple',
    'freeze-toolbar-keyboard', 'freeze-hover-comment', 'freeze-exit-enable', 'freeze-exit-selection', 'freeze-exit-dismiss',
    'history-pending-recopy', 'comments-continue-after-grab', 'disabled-keyboard', 'native-input-shortcuts', 'clipboard-denial-retry',
    'phone-controls', 'capture-pending-history', 'capture-retake-retry', 'capture-cancel-focus', 'demo-complete',
    ...(framework === 'vanilla' ? ['base-themes', 'base-history', 'base-selection-toggle', 'base-enable-disable', 'base-dismiss', 'base-actions-menu'] : []),
  ],
]));
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const href = path => path.split('/').map(encodeURIComponent).join('/');
function assetPath(suite, attachment) {
  if (!attachment.path || attachment.path.includes('\\')) return null;
  const parts = attachment.path.split('/');
  if (parts.some(p => !p || p === '..' || p === '.') || isAbsolute(attachment.path)) return null;
  return `${suite}/${attachment.path}`;
}

/** No inferred passes: missing suites, unfinished runs, skips, retries and errors fail review. */
export function aggregateReports(outputDir, execution = {}) {
  const suites = [], problems = [];
  const actual = readdirSync(outputDir, { withFileTypes: true }).filter(d => d.isDirectory() && existsSync(join(outputDir, d.name, 'suite.json'))).map(d => d.name);
  for (const name of actual.filter(name => !EXPECTED_SUITES.includes(name))) problems.push(`Unexpected suite: ${name}`);
  for (const name of EXPECTED_SUITES) {
    const path = join(outputDir, name, 'suite.json');
    if (!existsSync(path)) { problems.push(`Missing suite: ${name}`); continue; }
    try {
      const report = JSON.parse(readFileSync(path, 'utf8'));
      if (report.suite !== name || !Array.isArray(report.tests)) throw new Error('Invalid suite identity/tests');
      suites.push(report);
      try {
        const inventory = JSON.parse(readFileSync(join(outputDir, name, 'inventory.json'), 'utf8'));
        if (inventory.suite !== name || inventory.completed !== true || inventory.status !== 'passed'
          || inventory.forbidOnly !== true || !Array.isArray(inventory.errors) || inventory.errors.length
          || !Array.isArray(inventory.tests) || !inventory.tests.length) throw new Error('missing, unfinished, focused or failed discovery');
        const keys = tests => tests.map(t => {
          if (typeof t.id !== 'string' || !t.id || !Array.isArray(t.titlePath)) throw new Error('invalid test identity');
          return JSON.stringify([t.id, t.titlePath]);
        }).sort();
        const intended = keys(inventory.tests), recorded = keys(report.tests);
        if (new Set(intended).size !== intended.length || new Set(recorded).size !== recorded.length
          || JSON.stringify(intended) !== JSON.stringify(recorded)) problems.push(`${name}: inventory mismatch (independently listed ${intended.length}, recorded ${recorded.length})`);
      } catch (error) { problems.push(`${name}: invalid inventory: ${error.message}`); }
      if (!report.completed || report.status !== 'passed') problems.push(`${name}: incomplete or ${report.status ?? 'unknown'} run`);
      if (!report.tests.length) problems.push(`${name}: no tests`);
      if (report.errors?.length) problems.push(`${name}: ${report.errors.length} reporter/global errors`);
      for (const test of report.tests) {
        const label = `${name}: ${test.title}`;
        if (test.expectedStatus !== 'passed' || test.outcome !== 'expected' || test.attempts.length !== 1 || test.attempts[0]?.retry !== 0 || test.attempts[0]?.status !== 'passed') problems.push(`${label}: ${test.outcome}, expected ${test.expectedStatus}, attempts ${test.attempts.map(a => `${a.retry}:${a.status}`).join(', ') || 'none'}`);
        for (const attempt of test.attempts) {
          if (attempt.errors?.length) problems.push(`${label}: attempt ${attempt.retry} contains errors`);
          for (const type of ['image/', 'video/', 'application/zip']) {
            if (attempt.status !== 'skipped' && !attempt.attachments.some(a => a.contentType?.startsWith(type) && a.path)) problems.push(`${label}: attempt ${attempt.retry} missing ${type} evidence`);
          }
          for (const attachment of attempt.attachments) {
            const asset = assetPath(name, attachment);
            if (!asset || !existsSync(join(outputDir, asset)) || attachment.error) problems.push(`${label}: missing/invalid attachment ${attachment.name}`);
          }
        }
      }
    } catch (error) { problems.push(`${name}: invalid report: ${error.message}`); }
  }
  if (execution.exitCode !== 0 || execution.signal || execution.error) problems.push(`Runner unsuccessful: exit=${execution.exitCode ?? 'null'}, signal=${execution.signal ?? 'none'}${execution.error ? `, ${execution.error}` : ''}`);
  const coverage = [];
  for (const [suiteName, features] of Object.entries(REQUIRED_COVERAGE)) {
    const suite = suites.find(s => s.suite === suiteName);
    for (const feature of features) {
      const tests = (suite?.tests ?? []).filter(t => t.annotations?.some(a => (a.type === 'coverage' && a.description === feature) || (feature === 'demo-complete' && a.type === 'demo-complete')));
      const passing = tests.filter(t => t.outcome === 'expected' && t.attempts.length === 1 && t.attempts[0].status === 'passed');
      const evidenced = passing.filter(t => {
        const attachments = t.attempts[0].attachments;
        return attachments.some(a => a.contentType === 'image/png' && a.name !== 'screenshot')
          && (!/^(copy-|comments-(single|multiple))/.test(feature) || attachments.some(a => a.contentType === 'text/plain'));
      });
      const covered = evidenced.length > 0;
      coverage.push({ suite: suiteName, feature, covered, tests: evidenced.map(t => t.id) });
      if (!covered) problems.push(`Missing functional coverage: ${suiteName} / ${feature} (passing journey with named visual checkpoint and output evidence required)`);
    }
  }
  const tests = suites.flatMap(s => s.tests);
  for (const [suiteName, titles] of Object.entries(REQUIRED_DEMO_JOURNEYS)) {
    const suite = suites.find(s => s.suite === suiteName);
    for (const title of titles) {
      const tests = (suite?.tests ?? []).filter(t => t.title === title && t.outcome === 'expected'
        && t.attempts.length === 1 && t.attempts[0].status === 'passed'
        && t.attempts[0].attachments.some(a => a.contentType === 'image/png' && a.name !== 'screenshot')
        && t.annotations?.some(a => a.type === 'demo-complete' || (a.type === 'coverage' && a.description === 'demo-complete')));
      const covered = tests.length > 0;
      coverage.push({ suite: suiteName, feature: `demo: ${title}`, covered, tests: tests.map(t => t.id) });
      if (!covered) problems.push(`Missing demo journey: ${suiteName} / ${title}`);
    }
  }
  const counts = { suites: suites.length, tests: tests.length, attempts: 0, passed: 0, failed: 0, skipped: 0, notRun: 0, retried: 0, durationMs: 0 };
  for (const test of tests) {
    counts.attempts += test.attempts.length;
    counts.durationMs += test.attempts.reduce((n, a) => n + a.durationMs, 0);
    if (test.attempts.some(a => a.retry > 0)) counts.retried++;
    const last = test.attempts.at(-1);
    if (!last) counts.notRun++;
    else if (last.status === 'passed') counts.passed++;
    else if (last.status === 'skipped') counts.skipped++;
    else counts.failed++;
  }
  return { schemaVersion: 2, ok: problems.length === 0, expectedSuites: EXPECTED_SUITES, expectedFrameworks: FRAMEWORKS, counts, problems, coverage, execution, suites };
}

function renderAttempt(suite, attempt) {
  const attachments = attempt.attachments ?? [];
  const images = attachments.filter(a => a.contentType?.startsWith('image/') && assetPath(suite, a));
  const videos = attachments.filter(a => a.contentType?.startsWith('video/') && assetPath(suite, a));
  const poster = images.find(a => a.name === 'screenshot') ?? images.at(-1);
  return `<section class="attempt"><h4>Attempt ${escapeHtml(attempt.retry)} · ${escapeHtml(attempt.status)} · ${escapeHtml(attempt.durationMs)} ms</h4>
${videos.map(a => `<figure><video controls preload="none" ${poster ? `poster="${href(assetPath(suite, poster))}"` : ''} src="${href(assetPath(suite, a))}"></video><figcaption>${escapeHtml(a.name)}</figcaption></figure>`).join('')}
<div class="images">${images.map(a => `<figure><a href="${href(assetPath(suite, a))}"><img loading="lazy" src="${href(assetPath(suite, a))}" alt="${escapeHtml(a.name)}"></a><figcaption>${escapeHtml(a.name)}</figcaption></figure>`).join('')}</div>
${attachments.filter(a => a.previewText !== undefined).map(a => `<details><summary>${escapeHtml(a.name)} — actual captured output</summary><pre>${escapeHtml(a.previewText)}</pre></details>`).join('')}
<ul>${attachments.map(a => { const path = assetPath(suite, a); return `<li>${path ? `<a href="${href(path)}" download>${escapeHtml(a.name)}</a>` : escapeHtml(a.name)} <small>${escapeHtml(a.contentType)}</small>${a.error ? ` — ${escapeHtml(a.error.message)}` : ''}</li>`; }).join('')}</ul>
${(attempt.errors ?? []).map(e => `<pre class="error">${escapeHtml(e.stack ?? e.message)}${e.snippet ? `\n${escapeHtml(e.snippet)}` : ''}</pre>`).join('')}</section>`;
}

export function buildGallery(summary, provenance) {
  const coverageTable = `<section class="suite coverage"><h2>Functional evidence checklist · Vanilla base</h2><p>This checks the named journeys below, not universal product correctness or human visual acceptance. The previous 150-test recording was insufficient acceptance coverage.</p><table><thead><tr><th>Framework</th><th>Function / state</th><th>Recorded journey</th></tr></thead><tbody>${(summary.coverage ?? []).map(row => `<tr><td>${escapeHtml(row.suite)}</td><td>${escapeHtml(row.feature)}</td><td class="${row.covered ? 'pass' : 'fail'}">${row.covered ? row.tests.map(id => `<a href="#test-${encodeURIComponent(id)}">Review evidence</a>`).join(' · ') : 'MISSING'}</td></tr>`).join('')}</tbody></table></section>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Point Grab · browser evidence</title><style>
body{font:16px/1.5 system-ui,sans-serif;margin:0;background:#111827;color:#e5e7eb}main{max-width:1200px;margin:auto;padding:28px}a{color:#93c5fd}h1,h2,h3,h4{line-height:1.25}header,.suite,article{padding:20px;border:1px solid #475569;border-radius:10px;margin-bottom:20px}article{background:#1e293b}.pass{color:#86efac}.fail,.error{color:#fca5a5}input{width:min(90%,700px);padding:12px;font:inherit}pre{white-space:pre-wrap;overflow-wrap:anywhere}video{width:min(100%,900px);max-height:600px;background:#000}figure{margin:10px 0}.images{display:flex;flex-wrap:wrap;gap:16px}.images img{max-width:320px;max-height:240px;object-fit:contain}small,figcaption{color:#cbd5e1}.attempt{border-top:1px solid #475569}[hidden]{display:none!important}summary{cursor:pointer}
</style></head><body><main><header><h1>Point Grab · browser evidence</h1><h2 class="${summary.ok ? 'pass' : 'fail'}">${summary.ok ? 'Recorded journeys passed — visual acceptance pending' : 'NOT READY — failed tests or missing functional evidence'}</h2><p>${escapeHtml(JSON.stringify(summary.counts))}</p><p>Local review only. No publishing or uploads. Videos are loaded on demand. Traces download for local Playwright Trace Viewer.</p><p><a href="summary.json">Structured results</a> · <a href="provenance.json">Run provenance</a> · <a href="run.log">Combined log</a> · <a href="stdout.log">stdout</a> · <a href="stderr.log">stderr</a></p><ul class="fail">${summary.problems.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul><details><summary>Run provenance</summary><pre>${escapeHtml(JSON.stringify(provenance, null, 2))}</pre></details><label>Search tests, frameworks, statuses <input id="search" type="search" placeholder="framework-solid, freeze, skipped…"></label></header>
${coverageTable}
${summary.suites.map(s => `<section class="suite"><h2>${escapeHtml(s.suite)}</h2><p>${s.tests.length} tests · ${s.tests.reduce((n, t) => n + t.attempts.length, 0)} attempts · ${escapeHtml(s.status ?? 'unfinished')} · ${escapeHtml(s.durationMs ?? '?')} ms · <a href="${href(s.suite)}/suite.json">suite JSON</a></p>${(s.errors ?? []).map(e => `<pre class="error">${escapeHtml(e.stack ?? e.message)}</pre>`).join('')}${s.tests.map(t => `<article id="test-${encodeURIComponent(t.id)}"><h3>${escapeHtml(t.titlePath.join(' › '))}</h3><p>${escapeHtml(s.suite)} · ${escapeHtml(t.outcome)} · expected ${escapeHtml(t.expectedStatus)} · retry allowance ${escapeHtml(t.retries)} · ${escapeHtml(t.location?.file)}:${escapeHtml(t.location?.line)}</p>${(t.annotations ?? []).map(a => `<p>${escapeHtml(a.type)}: ${escapeHtml(a.description)}</p>`).join('')}${t.attempts.length ? t.attempts.map(a => renderAttempt(s.suite, a)).join('') : '<p class="fail">NOT RUN — no attempts recorded</p>'}</article>`).join('')}</section>`).join('')}
</main><script>document.addEventListener('click',e=>{if(e.target.closest('a[href^="#test-"]')){const search=document.getElementById('search');search.value='';search.dispatchEvent(new Event('input'))}});document.getElementById('search').addEventListener('input',function(){const q=this.value.toLowerCase();document.querySelectorAll('article').forEach(t=>{t.hidden=!t.textContent.toLowerCase().includes(q)});document.querySelectorAll('.suite:not(.coverage)').forEach(s=>{s.hidden=![...s.querySelectorAll('article')].some(t=>!t.hidden)})});</script></body></html>`;
}

// Resolve the nearest existing ancestor, including symlinks, without creating anything.
function canonicalPath(path) {
  const tail = [];
  let current = resolve(path);
  for (;;) {
    try { return resolve(realpathSync(current), ...tail); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = dirname(current);
      if (parent === current) throw error;
      tail.unshift(relative(parent, current));
      current = parent;
    }
  }
}
function contains(parent, child) {
  const path = relative(parent, child);
  return path === '' || (!isAbsolute(path) && !/^\.\.(?:[\\/]|$)/.test(path));
}
export function assertSafeOutput(outputDir, env = process.env) {
  const output = canonicalPath(outputDir);
  // screen-grab is standalone, but protecting its configured cleanup root is cheap.
  for (const suite of [...EXPECTED_SUITES, 'screen-grab']) {
    const runner = canonicalPath(runnerOutputDir(suite, env));
    if (contains(runner, output) || contains(output, runner)) throw new Error(`Review output overlaps runner output (${suite}): ${outputDir}`);
  }
}

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trimEnd() : `unavailable: ${result.stderr?.trim() || result.error?.message}`;
}
export async function main(args = process.argv.slice(2)) {
  if (args.includes('--help')) { console.log('Usage: pnpm run test:e2e:review [--output <new-directory>]'); return 0; }
  if (args.length && !(args.length === 2 && args[0] === '--output' && args[1])) throw new Error('Usage: review-e2e.mjs [--output <new-directory>]');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const outputDir = resolve(args[1] ?? join(root, 'test-results', `review-${new Date().toISOString().replace(/[:.]/g, '-')}`));
  assertSafeOutput(outputDir);
  mkdirSync(dirname(outputDir), { recursive: true });
  mkdirSync(outputDir); // Exclusive creation: never remove or reuse existing evidence.
  const execution = { command: [process.execPath, 'scripts/test-e2e.mjs'], cwd: root, startedAt: new Date().toISOString(), exitCode: null };
  let chromiumExecutable;
  try { chromiumExecutable = createRequire(import.meta.url)('@playwright/test').chromium.executablePath(); }
  catch (error) { chromiumExecutable = `unavailable: ${error.message}`; }
  const provenance = {
    ...execution, outputDir, head: git(root, ['rev-parse', 'HEAD']), dirtyState: git(root, ['status', '--porcelain=v1']),
    node: process.version, executable: process.execPath, platform: process.platform, architecture: process.arch,
    browserPaths: { AGENT_BROWSER_EXECUTABLE_PATH: process.env.AGENT_BROWSER_EXECUTABLE_PATH ?? null, PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH ?? null,
      playwrightChromiumExecutable: chromiumExecutable, playwrightChromiumExists: existsSync(chromiumExecutable) },
    invocation: process.argv, path: process.env.PATH,
  };
  writeFileSync(join(outputDir, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
  const streams = ['run.log', 'stdout.log', 'stderr.log'].map(name => createWriteStream(join(outputDir, name), { flags: 'wx' }));
  try {
    // Inventory every suite independently before any runner executes. CLI reporter
    // override avoids touching normal JSON reports during discovery.
    for (const suite of REVIEW_SUITES) {
      const result = spawnSync(process.execPath, [createRequire(import.meta.url).resolve('@playwright/test/cli'), 'test',
        `--config=${suite.config}`, '--list', '--forbid-only', `--reporter=${join(root, 'scripts/inventory-reporter.mjs')}`], {
        cwd: root, encoding: 'utf8', env: { ...process.env, POINT_GRAB_EVIDENCE_DIR: outputDir,
          POINT_GRAB_INVENTORY_SUITE: suite.name, ...(suite.framework ? { POINT_GRAB_FRAMEWORK: suite.framework } : {}) },
      });
      for (const [data, index] of [[result.stdout, 1], [result.stderr, 2]]) {
        if (data) { streams[0].write(data); streams[index].write(data); }
      }
      if (result.status !== 0 || result.error || result.signal) throw new Error(`Inventory discovery failed: ${suite.name} (exit ${result.status}): ${result.error?.message ?? result.stderr ?? ''}`);
    }
    await new Promise(resolveRun => {
      const child = spawn(execution.command[0], execution.command.slice(1), { cwd: root,
        env: { ...process.env, POINT_GRAB_EVIDENCE_DIR: outputDir, PATH: `${join(root, 'scripts/bin')}${delimiter}${process.env.PATH ?? ''}` }, stdio: ['inherit', 'pipe', 'pipe'] });
      child.stdout.on('data', data => { process.stdout.write(data); streams[0].write(data); streams[1].write(data); });
      child.stderr.on('data', data => { process.stderr.write(data); streams[0].write(data); streams[2].write(data); });
      child.on('error', error => { execution.error = error.message; });
      child.on('close', (code, signal) => { execution.exitCode = code; execution.signal = signal; resolveRun(); });
    });
  } catch (error) { execution.error = error.stack ?? error.message; }
  finally {
    await Promise.all(streams.map(stream => new Promise(resolveClose => stream.end(resolveClose))));
    execution.endedAt = new Date().toISOString();
    const summary = aggregateReports(outputDir, execution);
    writeFileSync(join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    writeFileSync(join(outputDir, 'index.html'), buildGallery(summary, provenance));
    console.log(`\nEvidence: ${outputDir}/index.html\n${summary.ok ? 'Complete clean pass' : 'Review NOT clean'}: ${summary.counts.tests} tests; ${summary.problems.length} issues.`);
    return summary.ok ? 0 : 1;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(code => { process.exitCode = code; }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
