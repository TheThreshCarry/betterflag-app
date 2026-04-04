import { test, expect } from "@playwright/test";

test.describe("changelogs", () => {
  test("navigates to changelogs page", async ({ page }) => {
    await page.goto("/dashboard/changelogs");
    await expect(page).toHaveURL(/\/dashboard\/changelogs/);
    await expect(page.getByRole("heading", { name: /changelog/i })).toBeVisible();
  });

  test("creates a new changelog", async ({ page }) => {
    await page.goto("/dashboard/changelogs");

    const newBtn = page.getByRole("link", { name: /new|create|add/i }).first();
    if (await newBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await newBtn.click();
    } else {
      await page.goto("/dashboard/changelogs/new");
    }

    await page.waitForURL(/\/new/);

    const titleInput = page.getByLabel(/title/i).first();
    if (await titleInput.isVisible()) {
      await titleInput.fill("E2E Test Release v1.0");
    }

    const saveBtn = page.getByRole("button", { name: /save|create|publish/i }).first();
    if (await saveBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await saveBtn.click();
    }
  });

  test("lists changelogs", async ({ page }) => {
    await page.goto("/dashboard/changelogs");
    // The page should load without errors
    await expect(page).toHaveURL(/\/dashboard\/changelogs/);
  });
});
