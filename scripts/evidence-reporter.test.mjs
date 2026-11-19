import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EvidenceReporter from './evidence-reporter.mjs';
import { aggregateReports, buildGallery, EXPECTED_SUITES, REQUIRED_COVERAGE, main } from './review-e2e.mjs';

// Unit fixtures only; these are never production/browser certification evidence.
const demoJourneys = JSON.parse(readFileSync(new URL('./review-demo-journeys.json', import.meta.url), 'utf8'));
const scratch = () => mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), 'point-grab-evidence-unit-'));
function attempt(status = 'passed', retry = 0) {
  return { retry, status, durationMs: 12, errors: [], attachments: [
    { name: 'screenshot', contentType: 'image/png', path: 'assets/screenshot.png' },
    { name: 'video', contentType: 'video/webm', path: 'assets/video.webm' },
    { name: 'trace', contentType: 'application/zip', path: 'assets/trace.zip' },
  ] };
}
function matrix(withCoverage = true) {
  const dir = scratch();
  for (const suite of EXPECTED_SUITES) {
    mkdirSync(join(dir, suite, 'assets'), { recursive: true });
    for (const file of ['screenshot.png', 'video.webm', 'trace.zip']) writeFileSync(join(dir, suite, 'assets', file), 'UNIT FIXTURE, NOT BROWSER OUTPUT');
    const fixture = {
      id: suite, title: 'unit fixture', titlePath: ['unit fixture'], expectedStatus: 'passed', outcome: 'expected', retries: 0,
      annotations: withCoverage ? (REQUIRED_COVERAGE[suite] ?? []).map(description => ({ type: 'coverage', description })) : [],
      attempts: [{ ...attempt(), attachments: [...attempt().attachments,
        { name: 'unit-named-checkpoint', contentType: 'image/png', path: 'assets/screenshot.png' },
        { name: 'unit-text-output', contentType: 'text/plain', path: 'assets/trace.zip' },
      ] }],
    };
    save(dir, suite, { suite, completed: true, status: 'passed', errors: [], tests: [fixture,
      ...(demoJourneys[suite] ?? []).map((title, i) => ({ ...fixture, id: `${suite}/demo-${i}`, title, titlePath: [title],
        annotations: withCoverage ? [{ type: 'demo-complete', description: 'UNIT FIXTURE, NOT BROWSER OUTPUT' }] : [] })),
    ] });
    const report = read(dir, suite);
    writeFileSync(join(dir, suite, 'inventory.json'), JSON.stringify({ suite, completed: true, status: 'passed', forbidOnly: true, errors: [], tests: report.tests.map(t => ({ id: t.id, titlePath: t.titlePath })) }));
  }
  return dir;
}
function save(dir, suite, report) { writeFileSync(join(dir, suite, 'suite.json'), JSON.stringify(report)); }
function read(dir, suite) { return JSON.parse(readFileSync(join(dir, suite, 'suite.json'), 'utf8')); }

test('reporter copies files and inline attachments before the next runner can clear originals', () => {
  const dir = scratch(), source = join(dir, 'source.webm');
  writeFileSync(source, 'UNIT VIDEO FIXTURE');
  const reporter = new EvidenceReporter({ outputDir: dir, suite: 'site' });
  const fixture = { id: 'project/id/../../title', title: '<script>hostile</script>', titlePath: () => ['<script>hostile</script>'],
    expectedStatus: 'passed', retries: 1, annotations: [], location: { file: 'unit.spec', line: 1 }, outcome: () => 'flaky' };
  reporter.onBegin({ projects: [], workers: 1 }, { allTests: () => [fixture] });
  for (const retry of [0, 1]) reporter.onTestEnd(fixture, { retry, status: retry ? 'passed' : 'failed', duration: 10, startTime: new Date(), workerIndex: 0,
    errors: retry ? [] : [new Error('<img src=x onerror=alert(1)>')], attachments: [
      { name: '../../hostile<video>', path: source, contentType: 'video/webm' },
      { name: 'named <screen>', body: Buffer.from('UNIT IMAGE FIXTURE'), contentType: 'image/png' },
    ] });
  unlinkSync(source); // Own temporary unit fixture only.
  reporter.onEnd({ status: 'passed', duration: 20 });
  const report = read(dir, 'site');
  assert.equal(report.completed, true);
  assert.equal(report.tests[0].attempts.length, 2);
  const [a, b] = report.tests[0].attempts;
  assert.notEqual(a.attachments[0].path, b.attachments[0].path);
  assert.equal(readFileSync(join(dir, 'site', a.attachments[0].path), 'utf8'), 'UNIT VIDEO FIXTURE');
  assert.equal(report.tests[0].outcome, 'flaky');
  assert.throws(() => new EvidenceReporter({ outputDir: dir, suite: 'site' }), /overwrite/);
  assert.throws(() => new EvidenceReporter({ outputDir: dir, suite: '../escape' }), /Invalid/);
});

test('opt-in config helpers are inert by default and expose the exact evidence contract', async () => {
  const { evidenceUse, evidenceReporters } = await import('../e2e/evidence.ts');
  const prior = process.env.POINT_GRAB_EVIDENCE_DIR;
  try {
    delete process.env.POINT_GRAB_EVIDENCE_DIR;
    assert.deepEqual(evidenceUse(), {});
    assert.deepEqual(evidenceReporters('site'), []);
    process.env.POINT_GRAB_EVIDENCE_DIR = 'test-results/unit-config-path-only';
    assert.deepEqual(evidenceUse(), { trace: 'on', screenshot: 'on', video: { mode: 'on', size: { width: 1440, height: 1000 } } });
    const [[reporter, options]] = evidenceReporters('site');
    assert.ok(reporter.startsWith('/'));
    assert.ok(options.outputDir.startsWith('/'));
    assert.equal(options.suite, 'site');
  } finally {
    if (prior === undefined) delete process.env.POINT_GRAB_EVIDENCE_DIR;
    else process.env.POINT_GRAB_EVIDENCE_DIR = prior;
  }
});

test('complete exact matrix passes, with structured counts', () => {
  const report = aggregateReports(matrix(), { exitCode: 0 });
  assert.equal(report.ok, true);
  assert.equal(report.counts.tests, EXPECTED_SUITES.length + Object.values(demoJourneys).reduce((n, titles) => n + titles.length, 0));
  assert.equal(report.counts.suites, EXPECTED_SUITES.length);
});

test('missing nonframework tests or independent inventory cannot be clean-green', () => {
  for (const suite of ['site', 'page-capture', 'freeze', 'solid-storefront']) {
    const dir = matrix();
    const inventoryPath = join(dir, suite, 'inventory.json');
    const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
    inventory.tests.push({ id: `${suite}/omitted`, titlePath: ['omitted nonframework test'] });
    writeFileSync(inventoryPath, JSON.stringify(inventory));
    let summary = aggregateReports(dir, { exitCode: 0 });
    assert.equal(summary.ok, false);
    assert.ok(summary.problems.some(p => p.includes(`${suite}: inventory mismatch`)));
    unlinkSync(inventoryPath);
    summary = aggregateReports(dir, { exitCode: 0 });
    assert.equal(summary.ok, false);
    assert.ok(summary.problems.some(p => p.includes(`${suite}: invalid inventory`)));
  }
});

test('focused or failed discovery inventory fails closed', () => {
  for (const changes of [{ forbidOnly: false }, { status: 'failed', errors: [{ message: 'test.only' }] }, { completed: false }]) {
    const dir = matrix();
    const path = join(dir, 'site', 'inventory.json');
    writeFileSync(path, JSON.stringify({ ...JSON.parse(readFileSync(path, 'utf8')), ...changes }));
    const summary = aggregateReports(dir, { exitCode: 0 });
    assert.equal(summary.ok, false);
    assert.ok(summary.problems.some(p => p.includes('site: invalid inventory')));
  }
});

test('a green test count without required functional journeys is not acceptance coverage', () => {
  const report = aggregateReports(matrix(false), { exitCode: 0 });
  assert.equal(report.ok, false);
  assert.ok(report.problems.some(p => p.includes('Missing functional coverage')));
});

test('one demo-complete badge cannot hide an omitted required demo journey', () => {
  const dir = matrix(), suite = 'framework-vue';
  const report = read(dir, suite);
  report.tests = report.tests.filter(t => t.title !== demoJourneys[suite][0]);
  save(dir, suite, report);
  const summary = aggregateReports(dir, { exitCode: 0 });
  assert.equal(summary.ok, false);
  assert.ok(summary.problems.some(p => p.includes(demoJourneys[suite][0])));
});

test('retries, skips, unrun tests, errors, missing media and suite omissions never green', () => {
  const dir = matrix();
  const site = read(dir, 'site');
  site.tests[0].attempts.push(attempt('passed', 1));
  site.tests[0].outcome = 'flaky';
  site.tests.push({ ...site.tests[0], id: 'skip', title: 'skip', outcome: 'skipped', attempts: [attempt('skipped')] });
  site.tests.push({ ...site.tests[0], id: 'not-run', title: 'not-run', outcome: 'not-run', attempts: [] });
  site.tests[0].attempts[0].attachments[0].path = '../outside.png';
  site.errors.push({ message: 'global error' });
  save(dir, 'site', site);
  unlinkSync(join(dir, 'framework-solid', 'suite.json')); // Own temporary unit fixture only.
  const report = aggregateReports(dir, { exitCode: 1 });
  assert.equal(report.ok, false);
  assert.equal(report.counts.retried, 1);
  assert.equal(report.counts.skipped, 1);
  assert.equal(report.counts.notRun, 1);
  assert.ok(report.problems.some(p => p.includes('Missing suite: framework-solid')));
  assert.ok(report.problems.some(p => p.includes('missing/invalid attachment')));
  assert.ok(report.problems.some(p => p.includes('global errors')));
});

test('gallery escapes titles, errors, annotations, provenance and uses lazy media', () => {
  const summary = aggregateReports(matrix(), { exitCode: 0 });
  const hostile = '<script>alert("owned")</script>';
  summary.suites[0].tests[0].titlePath = [hostile];
  summary.suites[0].tests[0].annotations = [{ type: hostile, description: hostile }];
  summary.suites[0].tests[0].attempts[0].errors = [{ message: hostile }];
  summary.suites[0].tests[0].attempts[0].attachments.push({ name: 'actual clipboard', contentType: 'text/plain', path: 'assets/result.txt', previewText: 'COPIED-CLASS-RESULT <div class="real">' });
  const html = buildGallery(summary, { head: hostile });
  assert.ok(html.includes('COPIED-CLASS-RESULT &lt;div'));
  assert.ok(!html.includes(hostile));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('preload="none"'));
  assert.ok(html.includes('loading="lazy"'));
  assert.ok(html.includes('poster='));
  assert.ok(html.includes('download>trace'));
});

test('runner refuses an existing directory before executing any browser command', async () => {
  const dir = scratch();
  writeFileSync(join(dir, 'keep.txt'), 'do not alter');
  await assert.rejects(main(['--output', dir]), /EEXIST/);
  assert.equal(readFileSync(join(dir, 'keep.txt'), 'utf8'), 'do not alter');
  assert.equal(existsSync(join(dir, 'run.log')), false);
});

test('reporter records attachment-copy failures and all not-run scheduled tests', () => {
  const dir = scratch(), reporter = new EvidenceReporter({ outputDir: dir, suite: 'freeze' });
  const fixture = { id: 'fixture', title: 'fixture', titlePath: () => ['fixture'], expectedStatus: 'passed', retries: 0, annotations: [], outcome: () => 'unexpected' };
  reporter.onBegin({ projects: [], workers: 1 }, { allTests: () => [fixture, { ...fixture, id: 'not-run' }] });
  reporter.onTestEnd(fixture, { retry: 0, status: 'failed', duration: 1, startTime: new Date(), errors: [], attachments: [{ name: 'missing', path: join(dir, 'absent'), contentType: 'video/webm' }] });
  reporter.onEnd({ status: 'failed', duration: 1 });
  const report = read(dir, 'freeze');
  assert.equal(report.errors.length, 1);
  assert.equal(report.tests[1].outcome, 'not-run');
});
