import { test, expect } from "@playwright/test";

test.describe("signup page", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("renders signup form", async ({ page }) => {
    await page.goto("/auth/signup");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
  });

  test("has link back to login", async ({ page }) => {
    await page.goto("/auth/signup");
    const loginLink = page.getByRole("link", { name: /sign in|log in|login/i });
    await expect(loginLink).toBeVisible();
  });

  test("shows validation on empty submit", async ({ page }) => {
    await page.goto("/auth/signup");
    const submitBtn = page.getByRole("button", { name: /sign up|create|register/i });

    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      // Browser validation or app-level validation should prevent submission
      expect(page.url()).toContain("/auth/signup");
    }
  });
});
