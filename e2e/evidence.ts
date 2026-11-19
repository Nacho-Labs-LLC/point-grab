import type { PlaywrightTestOptions, PlaywrightWorkerOptions, ReporterDescription } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
export { runnerOutputDir } from '../scripts/review-settings.cjs';

/** Opt-in only. Spread last in `use` to override failure-only defaults. */
export function evidenceUse(): Partial<PlaywrightTestOptions & PlaywrightWorkerOptions> {
  return process.env.POINT_GRAB_EVIDENCE_DIR
    ? { trace: 'on', screenshot: 'on', video: { mode: 'on', size: { width: 1440, height: 1000 } } }
    : {};
}

/** Spread into the existing reporter array; existing reporters remain unchanged. */
export function evidenceReporters(suite: string): ReporterDescription[] {
  const outputDir = process.env.POINT_GRAB_EVIDENCE_DIR;
  if (!outputDir) return [];
  // Playwright loads root configs as CJS and Solid as ESM: avoid import.meta/__dirname.
  let root = process.cwd();
  while (!existsSync(resolve(root, 'scripts/evidence-reporter.mjs'))) {
    const parent = dirname(root);
    if (parent === root) throw new Error('Cannot locate Point Grab evidence reporter');
    root = parent;
  }
  return [[resolve(root, 'scripts/evidence-reporter.mjs'), {
    suite, outputDir: resolve(outputDir),
  }]];
}
