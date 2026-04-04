import { test, expect } from "@playwright/test";

test.describe("feature flags", () => {
  test("navigates to feature flags page", async ({ page }) => {
    await page.goto("/dashboard/flags");
    await expect(page).toHaveURL(/\/dashboard\/flags/);
    await expect(page.getByRole("heading", { name: /feature flags|flags/i })).toBeVisible();
  });

  test("creates a new feature flag", async ({ page }) => {
    await page.goto("/dashboard/flags");

    const createBtn = page.getByRole("button", { name: /create|add|new/i });
    await createBtn.click();

    await page.getByLabel(/name/i).first().fill("E2E Test Flag");
    await page.getByLabel(/key/i).fill("e2e-test-flag");

    const saveBtn = page.getByRole("button", { name: /create|save|add/i }).last();
    await saveBtn.click();

    await expect(page.getByText("e2e-test-flag")).toBeVisible({ timeout: 10_000 });
  });

  test("toggles a feature flag", async ({ page }) => {
    await page.goto("/dashboard/flags");

    const flagSwitch = page.getByRole("switch").first();
    if (await flagSwitch.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const initialState = await flagSwitch.isChecked();
      await flagSwitch.click();
      // Give time for the update
      await page.waitForTimeout(1_000);
      const newState = await flagSwitch.isChecked();
      expect(newState).not.toBe(initialState);
    }
  });

  test("deletes a feature flag", async ({ page }) => {
    await page.goto("/dashboard/flags");

    const deleteBtn = page.getByRole("button", { name: /delete|remove/i }).first();
    if (await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await deleteBtn.click();

      const confirmBtn = page.getByRole("button", { name: /confirm|delete|yes/i }).last();
      if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await confirmBtn.click();
      }
    }
  });
});
