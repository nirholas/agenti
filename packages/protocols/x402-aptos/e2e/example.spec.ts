import { test, expect } from "@playwright/test";

test("homepage loads successfully", async ({ page }) => {
  await page.goto("/");

  // Wait for the page to load
  await page.waitForLoadState("networkidle");

  // Check that we can see some expected content
  const bodyText = await page.textContent("body");
  expect(bodyText).toBeTruthy();
});
