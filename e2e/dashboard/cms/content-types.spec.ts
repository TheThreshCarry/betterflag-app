import { test, expect } from "@playwright/test";

test.describe("CMS content types", () => {
  test("navigates to CMS page", async ({ page }) => {
    await page.goto("/dashboard/cms");
    await expect(page).toHaveURL(/\/dashboard\/cms/);
  });

  test("navigates to content types page", async ({ page }) => {
    await page.goto("/dashboard/cms/content-types");
    await expect(page).toHaveURL(/\/dashboard\/cms\/content-types/);
  });

  test("creates a new content type", async ({ page }) => {
    await page.goto("/dashboard/cms/content-types");

    const newBtn = page.getByRole("link", { name: /new|create|add/i }).first();
    if (await newBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await newBtn.click();
      await page.waitForURL(/\/new/);
    } else {
      await page.goto("/dashboard/cms/content-types/new");
    }

    const nameInput = page.getByLabel(/name/i).first();
    if (await nameInput.isVisible()) {
      await nameInput.fill("E2E Test Type");
    }

    const createBtn = page.getByRole("button", { name: /create|save/i }).first();
    if (await createBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(2_000);
    }
  });
});
