import { defineConfig } from '@playwright/test';
import { evidenceUse, evidenceReporters, runnerOutputDir } from './e2e/evidence';
export default defineConfig({ testDir: './e2e', testMatch: 'freeze.spec.mts', workers: 1, retries: 0,
  forbidOnly: Boolean(process.env.POINT_GRAB_EVIDENCE_DIR),
  outputDir: runnerOutputDir('freeze'),
  reporter: [['list'], ...evidenceReporters('freeze')],
  timeout: 20_000, use: { browserName: 'chromium', headless: true, viewport: { width: 1000, height: 700 }, ...evidenceUse(),
    launchOptions: { executablePath: process.env.AGENT_BROWSER_EXECUTABLE_PATH, args: ['--no-sandbox'] } } });
