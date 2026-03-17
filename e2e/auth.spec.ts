import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login page', async ({ page }) => {
    await expect(page).toHaveTitle(/KudosWall/);
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('should navigate through sidebar menu', async ({ page }) => {
    // Click on Projects
    await page.click('text=Projects');
    await expect(page).toHaveURL(/.*projects/);
    await expect(page.locator('h1:has-text("Projects")')).toBeVisible();

    // Click on Mentions
    await page.click('text=Mentions');
    await expect(page).toHaveURL(/.*mentions/);
    await expect(page.locator('h1:has-text("Mentions")')).toBeVisible();

    // Click on Settings
    await page.click('text=Settings');
    await expect(page).toHaveURL(/.*settings/);
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
  });
});
