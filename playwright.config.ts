import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Marketing-site live demo only. Framework demos are verified by the per-framework
 * contract + demo specs (playwright.framework-matrix.config.ts, one server at a time);
 * `pnpm run test:e2e` runs every browser suite in sequence.
 */
export default defineConfig({
  testDir: './e2e',
  // A subfolder: Playwright empties outputDir, which would wipe the other suites' reports.
  outputDir: 'test-results/site',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    headless: true,
    trace: 'retain-on-failure',
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
