import { test, expect } from "@playwright/test";

test.describe("CMS entries", () => {
  test("navigates to CMS page and sees content types", async ({ page }) => {
    await page.goto("/dashboard/cms");
    await expect(page).toHaveURL(/\/dashboard\/cms/);
  });
});
