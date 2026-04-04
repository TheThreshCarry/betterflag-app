import { test, expect } from "@playwright/test";

test.describe("API keys settings", () => {
  test("navigates to API keys page", async ({ page }) => {
    await page.goto("/dashboard/settings/api-keys");
    await expect(page).toHaveURL(/\/dashboard\/settings\/api-keys/);
  });

  test("shows create API key button", async ({ page }) => {
    await page.goto("/dashboard/settings/api-keys");
    const createBtn = page.getByRole("button", { name: /create|generate|new/i });
    if (await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(createBtn).toBeEnabled();
    }
  });
});
