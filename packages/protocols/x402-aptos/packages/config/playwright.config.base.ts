import { defineConfig, devices } from "@playwright/test";

/**
 * Base Playwright configuration for x402a monorepo
 * See https://playwright.dev/docs/test-configuration.
 */
export const baseConfig = defineConfig({
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Use parallel workers on CI for faster execution */
  workers: process.env.CI ? 4 : undefined,
  /* Stop after first few failures to save time */
  maxFailures: process.env.CI ? 10 : undefined,
  /* Global timeout for each test */
  timeout: 30 * 1000,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? [["github"], ["html"]] : [["list"], ["html"]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || "http://localhost:3001",

    /* Collect trace only on CI failures for debugging */
    trace: process.env.CI ? "on-first-retry" : "off",

    /* Screenshot on failure */
    screenshot: "only-on-failure",

    /* Video on failure */
    video: "retain-on-failure",

    /* Action timeout */
    actionTimeout: 10 * 1000,
  },

  /* Configure projects for major browsers */
  projects: process.env.CI
    ? [
        // Run all browsers on CI
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },
        {
          name: "firefox",
          use: { ...devices["Desktop Firefox"] },
        },
        {
          name: "webkit",
          use: { ...devices["Desktop Safari"] },
        },
      ]
    : [
        // Run only Chromium locally for faster feedback
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },
      ],
});

export default baseConfig;
