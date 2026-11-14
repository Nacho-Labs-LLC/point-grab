import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './e2e', testMatch: 'freeze.spec.mts', workers: 1, retries: 0,
  outputDir: 'test-results/freeze',
  timeout: 20_000, use: { browserName: 'chromium', headless: true, viewport: { width: 1000, height: 700 },
    launchOptions: { executablePath: process.env.AGENT_BROWSER_EXECUTABLE_PATH, args: ['--no-sandbox'] } } });
