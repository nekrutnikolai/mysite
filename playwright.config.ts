import { defineConfig, devices } from "@playwright/test";
import { BASE_URL } from "./tests/fixtures/base-url";

const CI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  reporter: [
    ["list"],
    ["html", { outputFolder: "test-results/html-report", open: "never" }],
  ],
  outputDir: "test-results/artifacts",
  snapshotPathTemplate: "tests/snapshots/{testFilePath}-snapshots/{arg}{ext}",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !CI,
    timeout: 30_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  forbidOnly: CI,
  retries: CI ? 2 : 0,
});
