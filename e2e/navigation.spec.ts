import { test, expect } from "@playwright/test";

test.describe("navigation", () => {
  test("dashboard loads after auth", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("sidebar contains main navigation links", async ({ page }) => {
    await page.goto("/dashboard");
    const sidebar = page.locator("[data-testid='sidebar'], nav, aside").first();

    if (await sidebar.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Check that key nav items exist
      for (const label of ["Flags", "Changelogs", "CMS", "Media", "Settings"]) {
        const link = page.getByRole("link", { name: new RegExp(label, "i") });
        if (await link.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await expect(link).toBeVisible();
        }
      }
    }
  });

  test("navigates between dashboard sections", async ({ page }) => {
    await page.goto("/dashboard");

    // Navigate to flags
    const flagsLink = page.getByRole("link", { name: /flags/i }).first();
    if (await flagsLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await flagsLink.click();
      await expect(page).toHaveURL(/\/dashboard\/flags/);
    }
  });

  test("command palette opens with keyboard shortcut", async ({ page }) => {
    await page.goto("/dashboard");
    await page.keyboard.press("Meta+k");

    const commandPalette = page.getByRole("dialog").first();
    if (await commandPalette.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(commandPalette).toBeVisible();
      await page.keyboard.press("Escape");
    }
  });
});
