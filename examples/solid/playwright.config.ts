import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { evidenceUse, evidenceReporters, runnerOutputDir } from "../../e2e/evidence";

export default defineConfig({
  forbidOnly: Boolean(process.env.POINT_GRAB_EVIDENCE_DIR),
  testDir: "./tests",
  workers: 1,
  retries: 0,
  reporter: [["list"], ...evidenceReporters('solid-storefront')],
  outputDir: runnerOutputDir('solid-storefront'),
  use: {
    baseURL: "http://127.0.0.1:5290",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    permissions: ["clipboard-read", "clipboard-write"],
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...evidenceUse(),
  },
  webServer: {
    command: "pnpm exec vite --host 127.0.0.1 --port 5290 --strictPort",
    cwd: fileURLToPath(new URL(".", import.meta.url)),
    url: "http://127.0.0.1:5290",
    reuseExistingServer: false,
  },
});
