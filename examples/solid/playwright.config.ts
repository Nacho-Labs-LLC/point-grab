import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: process.env.SOLID_TEST_OUTPUT ?? "../../test-results/solid-demo",
  use: {
    baseURL: "http://127.0.0.1:5288",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    permissions: ["clipboard-read", "clipboard-write"],
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "npx --yes pnpm@9.15.0 exec vite --host 127.0.0.1 --port 5288 --strictPort",
    url: "http://127.0.0.1:5288",
    reuseExistingServer: false,
  },
});
