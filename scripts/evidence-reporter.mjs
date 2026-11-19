import { copyFileSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { createHash } from 'node:crypto';

export function safeName(value) {
  return String(value).replace(/[^a-zA-Z0-9_.-]+/g, '-').replace(/^\.+/, '').slice(0, 70) || 'attachment';
}
export function serializeError(error) {
  return { message: error?.message ?? String(error), stack: error?.stack, snippet: error?.snippet };
}

/** Copies onTestEnd, after context teardown, before another runner clears test-results. */
export default class EvidenceReporter {
  constructor({ suite, outputDir }) {
    if (!/^(site|framework-[a-z-]+|page-capture|freeze|solid-storefront)$/.test(suite)) throw new Error(`Invalid evidence suite: ${suite}`);
    this.suite = suite;
    this.outputDir = resolve(outputDir);
    this.dir = join(this.outputDir, suite);
    mkdirSync(this.dir, { recursive: true });
    this.file = join(this.dir, 'suite.json');
    if (existsSync(this.file)) throw new Error(`Refusing to overwrite evidence: ${this.file}`);
    this.report = { schemaVersion: 1, suite, startedAt: new Date().toISOString(), completed: false, tests: [], errors: [] };
    this.byId = new Map();
  }
  printsToStdio() { return false; }
  save() { writeFileSync(this.file, JSON.stringify(this.report, null, 2) + '\n'); }
  onBegin(config, suite) {
    this.report.config = {
      workers: config.workers, version: config.version,
      projects: config.projects.map(p => ({ name: p.name, retries: p.retries, use: {
        browserName: p.use.browserName, channel: p.use.channel,
        executablePath: p.use.launchOptions?.executablePath,
        viewport: p.use.viewport, video: p.use.video, trace: p.use.trace, screenshot: p.use.screenshot,
      } })),
    };
    for (const test of suite.allTests()) {
      const item = { id: test.id, title: test.title, titlePath: test.titlePath(), location: test.location,
        expectedStatus: test.expectedStatus, retries: test.retries, annotations: test.annotations, attempts: [], outcome: 'not-run' };
      this.report.tests.push(item);
      this.byId.set(test.id, item);
    }
    this.save();
  }
  onTestEnd(test, result) {
    const item = this.byId.get(test.id);
    const hash = createHash('sha256').update(test.id).digest('hex').slice(0, 20);
    const relativeDir = `assets/${hash}/attempt-${result.retry}`;
    const targetDir = join(this.dir, relativeDir);
    mkdirSync(targetDir, { recursive: true });
    const attachments = result.attachments.map((attachment, index) => {
      const extension = extname(attachment.path ?? '') || ({ 'image/png': '.png', 'video/webm': '.webm', 'application/zip': '.zip', 'text/plain': '.txt', 'application/json': '.json' }[attachment.contentType] ?? '.bin');
      const filename = `${index}-${safeName(attachment.name)}${extension}`;
      const record = { name: attachment.name, contentType: attachment.contentType };
      try {
        if (attachment.path) copyFileSync(attachment.path, join(targetDir, filename));
        else if (attachment.body !== undefined) writeFileSync(join(targetDir, filename), attachment.body);
        else throw new Error('Attachment has neither path nor body');
        record.path = `${relativeDir}/${filename}`;
        if (['text/plain', 'application/json'].includes(attachment.contentType)) {
          record.previewText = readFileSync(join(targetDir, filename), 'utf8').slice(0, 100_000);
        }
      } catch (error) {
        record.error = serializeError(error);
        this.report.errors.push({ message: `Attachment copy failed: ${attachment.name}`, cause: serializeError(error) });
      }
      return record;
    });
    item.expectedStatus = test.expectedStatus;
    item.annotations = test.annotations;
    item.attempts.push({ retry: result.retry, status: result.status, durationMs: result.duration,
      startTime: result.startTime.toISOString(), workerIndex: result.workerIndex,
      errors: result.errors.map(serializeError), attachments });
    item.outcome = test.outcome();
    this.save();
  }
  onError(error) { this.report.errors.push(serializeError(error)); this.save(); }
  onEnd(result) {
    this.report.completed = true;
    this.report.status = result.status;
    this.report.durationMs = result.duration;
    this.report.endedAt = new Date().toISOString();
    this.save();
  }
}
