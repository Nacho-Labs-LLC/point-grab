import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { evidenceUse, evidenceReporters, runnerOutputDir } from './e2e/evidence';

const framework = process.env.POINT_GRAB_FRAMEWORK ?? 'vanilla';
const frameworks = ['vanilla', 'react', 'vue', 'angular', 'svelte', 'web-components', 'solid'];
if (!frameworks.includes(framework)) throw new Error(`Unknown framework: ${framework}`);
export default defineConfig({
  forbidOnly: Boolean(process.env.POINT_GRAB_EVIDENCE_DIR),
  // Shared feature contract + the demo's own app/adapter journeys, one framework at a time.
  testDir: './e2e/framework', testMatch: [
    'contract.spec.mts', 'full-actions.spec.mts', 'full-freeze.spec.mts', 'recovery.spec.mts', 'responsive.spec.mts',
    ...(framework === 'vanilla' ? ['base-controls.spec.mts'] : []),
    `demos/${framework}.spec.mts`, `demos/${framework}.extended.spec.mts`,
  ],
  workers: 1, fullyParallel: false, retries: 0, timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['json', { outputFile: `test-results/framework-matrix/${framework}.json` }], ...evidenceReporters(`framework-${framework}`)],
  outputDir: runnerOutputDir(`framework-${framework}`),
  use: {
    baseURL: 'http://127.0.0.1:5188', browserName: 'chromium', headless: true,
    viewport: { width: 1000, height: 700 }, permissions: ['clipboard-read', 'clipboard-write'],
    trace: 'retain-on-failure', screenshot: 'only-on-failure',
    ...evidenceUse(),
    launchOptions: {
      ...(process.env.AGENT_BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.AGENT_BROWSER_EXECUTABLE_PATH } : {}),
      args: ['--no-sandbox'],
    },
  },
  webServer: {
    command: framework === 'angular'
      ? 'pnpm exec ng serve --host 127.0.0.1 --port 5188'
      : 'pnpm exec vite --host 127.0.0.1 --port 5188 --strictPort',
    cwd: path.resolve('examples', framework), url: 'http://127.0.0.1:5188',
    reuseExistingServer: false, timeout: 120_000,
    env: { NG_BUILD_MAX_WORKERS: '1' },
  },
});
