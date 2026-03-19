import { defineConfig } from "@playwright/test";
import { baseConfig } from "@x402a/config/playwright.config.base";

/**
 * Root Playwright configuration extending base config
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...baseConfig,
  testDir: "./e2e",

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "bun run --filter nextjs-app-router-example dev",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
