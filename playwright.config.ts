import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests for Earned run against a production build in DEMO mode (no credentials needed).
 * `npm run build` first; the web server below reuses an already-running server on port 3200.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3200",
    ...devices["iPhone 13"],
    timezoneId: "America/Denver",
    trace: "off",
  },
  projects: [{ name: "iphone-chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "npx next start -p 3200",
    url: "http://localhost:3200/earned/sign-in",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
