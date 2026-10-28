import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  timeout: 40000,
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-webkit", testMatch: /date-filters\.spec\.ts/, use: { ...devices["iPhone 13"], defaultBrowserType: "webkit" } },
  ],
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : {
        command: "npm.cmd run preview -- --port 4173 --strictPort",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: !process.env.CI,
      },
});
