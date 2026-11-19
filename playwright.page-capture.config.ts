import { defineConfig } from '@playwright/test';
import { evidenceUse, evidenceReporters, runnerOutputDir } from './e2e/evidence';
export default defineConfig({
  forbidOnly: Boolean(process.env.POINT_GRAB_EVIDENCE_DIR),
  testDir: './e2e', testMatch: 'page-capture.spec.mts', workers: 1, retries: 0,
  timeout: 30000, expect: { timeout: 10000 }, reporter: [['list'], ...evidenceReporters('page-capture')],
  outputDir: runnerOutputDir('page-capture'),
  use: { browserName: 'chromium', headless: true, viewport: { width: 1000, height: 700 },
    permissions: ['clipboard-read', 'clipboard-write'], trace: 'retain-on-failure', screenshot: 'only-on-failure',
    ...evidenceUse(),
    launchOptions: { executablePath: process.env.AGENT_BROWSER_EXECUTABLE_PATH, args: ['--no-sandbox'] } },
});
