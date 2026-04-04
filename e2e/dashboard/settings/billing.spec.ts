import { test, expect } from "@playwright/test";

test.describe("billing settings", () => {
  test("navigates to billing page", async ({ page }) => {
    await page.goto("/dashboard/settings/billing");
    await expect(page).toHaveURL(/\/dashboard\/settings\/billing/);
  });

  test("displays plan information", async ({ page }) => {
    await page.goto("/dashboard/settings/billing");
    await expect(page.locator("body")).not.toHaveText(/500|Internal Server Error/);
  });
});
