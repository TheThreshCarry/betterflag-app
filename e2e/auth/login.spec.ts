import { test, expect } from "@playwright/test";

test.describe("login page", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("renders login form", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByRole("heading", { name: /sign in|log in|login/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel(/email/i).fill("invalid@test.local");
    await page.getByLabel(/password/i).fill("wrongpassword");

    const submitBtn = page.getByRole("button", { name: /sign in|log in|login/i });
    await submitBtn.click();

    await expect(
      page.getByText(/invalid|incorrect|error|not found/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("redirects unauthenticated users from dashboard to login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/auth\/login/);
    expect(page.url()).toContain("/auth/login");
  });

  test("has link to signup page", async ({ page }) => {
    await page.goto("/auth/login");
    const signupLink = page.getByRole("link", { name: /sign up|create account|register/i });
    await expect(signupLink).toBeVisible();
  });

  test("has link to forgot password", async ({ page }) => {
    await page.goto("/auth/login");
    const forgotLink = page.getByRole("link", { name: /forgot|reset/i });
    await expect(forgotLink).toBeVisible();
  });
});
