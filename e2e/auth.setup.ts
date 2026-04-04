import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth/user.json");

setup("authenticate", async ({ page }) => {
  await page.goto("/auth/signup");

  const timestamp = Date.now();
  const testEmail = `e2e-test-${timestamp}@test.local`;
  const testPassword = "TestPassword123!";

  await page.getByLabel(/name/i).first().fill("E2E Tester");
  await page.getByLabel(/email/i).fill(testEmail);
  await page.getByLabel(/^password$/i).fill(testPassword);
  await page.getByLabel(/confirm password/i).fill(testPassword);

  const submitBtn = page.getByRole("button", { name: /sign up|create account|register/i });
  if (await submitBtn.isVisible()) {
    await submitBtn.click();
  }

  // Wait for navigation away from auth pages
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 15_000 });

  // Handle onboarding if redirected there
  if (page.url().includes("/onboarding")) {
    const orgNameInput = page.getByLabel(/organization|team|company/i).first();
    if (await orgNameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await orgNameInput.fill("E2E Test Org");

      const continueBtn = page.getByRole("button", { name: /continue|create|next/i });
      if (await continueBtn.isVisible()) {
        await continueBtn.click();
      }
    }

    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  }

  expect(page.url()).toContain("/dashboard");

  await page.context().storageState({ path: authFile });
});
