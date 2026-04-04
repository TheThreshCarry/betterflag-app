import { test, expect } from "@playwright/test";

test.describe("media library", () => {
  test("navigates to media page", async ({ page }) => {
    await page.goto("/dashboard/media");
    await expect(page).toHaveURL(/\/dashboard\/media/);
  });

  test("media page renders without errors", async ({ page }) => {
    await page.goto("/dashboard/media");
    // Should not show error pages
    await expect(page.locator("body")).not.toHaveText(/500|Internal Server Error/);
  });
});
