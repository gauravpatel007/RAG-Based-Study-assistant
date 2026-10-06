import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should allow user to login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'user');
    await page.fill('input[type="password"]', 'user');
    await page.click('button[type="submit"]');

    // Should redirect to study home
    await expect(page).toHaveURL(/\/app/);
    await expect(page.locator('h1')).toContainText('Study Dashboard');
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'user');
    await page.fill('input[type="password"]', 'wrong');
    await page.click('button[type="submit"]');

    await expect(page.locator('[role="alert"]')).toBeVisible();
  });
});
