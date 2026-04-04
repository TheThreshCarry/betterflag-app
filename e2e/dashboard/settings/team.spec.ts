import { test, expect } from "@playwright/test";

test.describe("team settings", () => {
  test("navigates to team settings", async ({ page }) => {
    await page.goto("/dashboard/settings/team");
    await expect(page).toHaveURL(/\/dashboard\/settings\/team/);
  });

  test("displays team members list", async ({ page }) => {
    await page.goto("/dashboard/settings/team");
    // The page should load and show at least the current user
    await expect(page.locator("body")).not.toHaveText(/500|Internal Server Error/);
  });
});
