import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const examplesDir = path.resolve(__dirname, 'examples');

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: process.env.CI ? 3 : 1,
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    headless: true,
    trace: 'retain-on-failure',
    permissions: ['clipboard-read', 'clipboard-write'],
  },

  projects: [
    {
      name: 'vanilla',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5173' },
      testMatch: '**/vanilla.spec.ts',
    },
    {
      name: 'react',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5174' },
      testMatch: '**/react.spec.ts',
    },
    {
      name: 'vue',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5175' },
      testMatch: '**/vue.spec.ts',
    },
    {
      name: 'svelte',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5176' },
      testMatch: '**/svelte.spec.ts',
    },
    {
      name: 'web-components',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5177' },
      testMatch: '**/web-components.spec.ts',
    },
    {
      name: 'angular',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4200' },
      testMatch: '**/angular.spec.ts',
    },
    {
      name: 'site-livedemo',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4321' },
      testMatch: '**/site-livedemo.spec.ts',
    },
  ],

  webServer: [
    {
      command: 'pnpm exec vite --port 5173',
      cwd: path.join(examplesDir, 'vanilla'),
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm exec vite --port 5174',
      cwd: path.join(examplesDir, 'react'),
      url: 'http://localhost:5174',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm exec vite --port 5175',
      cwd: path.join(examplesDir, 'vue'),
      url: 'http://localhost:5175',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm exec vite --port 5176',
      cwd: path.join(examplesDir, 'svelte'),
      url: 'http://localhost:5176',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm exec vite --port 5177',
      cwd: path.join(examplesDir, 'web-components'),
      url: 'http://localhost:5177',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm exec ng serve --host 127.0.0.1 --port 4200',
      cwd: path.join(examplesDir, 'angular'),
      url: 'http://127.0.0.1:4200',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'bash -lc "pnpm exec astro build >/tmp/point-grab-site-build.log && node ../scripts/serve-static.mjs dist 4321 127.0.0.1"',
      cwd: path.resolve(__dirname, 'site'),
      url: 'http://127.0.0.1:4321',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
