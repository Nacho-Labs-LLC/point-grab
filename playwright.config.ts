import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { evidenceUse, evidenceReporters, runnerOutputDir } from './e2e/evidence';

/**
 * Marketing-site live demo only. Framework demos are verified by the per-framework
 * contract + demo specs (playwright.framework-matrix.config.ts, one server at a time);
 * `pnpm run test:e2e` runs every browser suite in sequence.
 */
export default defineConfig({
  forbidOnly: Boolean(process.env.POINT_GRAB_EVIDENCE_DIR),
  testDir: './e2e',
  // A subfolder: Playwright empties outputDir, which would wipe the other suites' reports.
  outputDir: runnerOutputDir('site'),
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 1,
  reporter: [...(process.env.CI ? [['github'] as const, ['list'] as const] : [['list'] as const]), ...evidenceReporters('site')],

  use: {
    headless: true,
    launchOptions: process.env.AGENT_BROWSER_EXECUTABLE_PATH
      ? { executablePath: process.env.AGENT_BROWSER_EXECUTABLE_PATH }
      : undefined,
    trace: 'retain-on-failure',
    ...evidenceUse(),
    permissions: ['clipboard-read', 'clipboard-write'],
  },

  projects: [
    {
      name: 'site-livedemo',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4321' },
      testMatch: '**/site-livedemo.spec.ts',
    },
  ],

  webServer: [
    {
      command: 'pnpm exec astro build && pnpm exec vite preview --host 127.0.0.1 --port 4321',
      cwd: path.resolve(__dirname, 'site'),
      url: 'http://127.0.0.1:4321',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
