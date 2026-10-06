import { test, expect } from '@playwright/test';

test.describe('Chat Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'user');
    await page.fill('input[type="password"]', 'user');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/app/);
  });

  test('should create a new chat and allow sending a message', async ({ page }) => {
    await page.click('text="New Chat"');
    await expect(page).toHaveURL(/\/app\/chats\/[a-f0-9-]+/);
    
    // Check if composer exists
    const input = page.locator('textarea[placeholder*="Ask a question"]');
    await expect(input).toBeVisible();

    await input.fill('Hello, who are you?');
    await page.click('button[aria-label="Send"]');

    // Wait for message to appear
    await expect(page.locator('text="Hello, who are you?"')).toBeVisible();
    
    // Check for bot response placeholder (as model might take time to reply)
    await expect(page.locator('.message-bot')).toBeVisible();
  });
});
