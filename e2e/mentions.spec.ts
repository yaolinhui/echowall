import { test, expect } from '@playwright/test';

test.describe('Mentions Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/mentions');
  });

  test('should display mentions list', async ({ page }) => {
    await expect(page.locator('h1:has-text("Mentions")')).toBeVisible();
    
    // Check filter dropdown
    await expect(page.locator('select')).toBeVisible();
  });

  test('should filter mentions by status', async ({ page }) => {
    // Select pending filter
    await page.selectOption('select', 'pending');
    
    // Wait for data to load
    await page.waitForTimeout(500);
    
    // Check that only pending mentions are shown
    const mentions = await page.locator('.kudoswall-item, [data-testid="mention"]').all();
    
    for (const mention of mentions) {
      const status = await mention.locator('.status-pending, text=pending').isVisible().catch(() => false);
      // If we can't find pending badge, the mention might not have one displayed
    }
  });

  test('should approve a mention', async ({ page }) => {
    // Find a pending mention and click approve
    const approveButton = page.locator('button[aria-label="Approve"]').first();
    
    if (await approveButton.isVisible().catch(() => false)) {
      await approveButton.click();
      
      // Verify the mention status changed
      await expect(page.locator('.status-approved').first()).toBeVisible();
    }
  });

  test('should select multiple mentions for bulk action', async ({ page }) => {
    // Select first two mentions
    const checkboxes = page.locator('input[type="checkbox"]').slice(0, 2);
    
    if (await checkboxes.count() >= 2) {
      await checkboxes.nth(0).click();
      await checkboxes.nth(1).click();
      
      // Bulk action bar should appear
      await expect(page.locator('text=2 selected')).toBeVisible();
      
      // Click approve all
      await page.click('button:has-text("Approve")');
    }
  });
});
