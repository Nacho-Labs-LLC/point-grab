import { defineConfig } from '@playwright/test';

// Intentionally isolated: no demo fleet, polling, or parallel browser workers.
export default defineConfig({
  testDir: './e2e', testMatch: 'screen-grab.spec.mts', workers: 1, retries: 0,
  timeout: 30000, reporter: 'list', outputDir: 'test-results/screen-grab',
  use: {
    browserName: 'chromium', headless: true, viewport: { width: 1000, height: 700 },
    permissions: ['clipboard-read', 'clipboard-write'],
    launchOptions: {
      ...(process.env.AGENT_BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.AGENT_BROWSER_EXECUTABLE_PATH } : {}),
      args: ['--no-sandbox'],
    },
    trace: 'retain-on-failure', screenshot: 'only-on-failure',
  },
});
