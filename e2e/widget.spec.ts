import { test, expect } from '@playwright/test';

test.describe('Widget Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Create a project with mentions first
    await page.goto('/projects');
    await page.click('text=New Project');
    await page.fill('input[name="name"]', 'Widget Test Project');
    await page.click('button:has-text("Create")');
    
    // Navigate to project detail
    await page.goto('/projects');
    await page.locator('[data-testid="project-settings"]').first().click();
  });

  test('should display widget settings', async ({ page }) => {
    await expect(page.locator('h2:has-text("Widget")')).toBeVisible();
    await expect(page.locator('text=Layout')).toBeVisible();
    await expect(page.locator('text=Theme')).toBeVisible();
  });

  test('should generate embed code', async ({ page }) => {
    // Click get embed code button
    await page.click('text=Get Embed Code');
    
    // Modal should open with embed code
    await expect(page.locator('text=Embed Code')).toBeVisible();
    await expect(page.locator('pre')).toBeVisible();
    
    // Copy button should be present
    await expect(page.locator('button:has-text("Copy Code")')).toBeVisible();
  });

  test('should copy embed code to clipboard', async ({ page }) => {
    await page.click('text=Get Embed Code');
    
    // Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    
    // Click copy
    await page.click('button:has-text("Copy Code")');
    
    // Verify clipboard has content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('kudoswall');
  });
});

// Test the actual widget rendering
test.describe('Widget Rendering', () => {
  test('widget should render on external page', async ({ page }) => {
    // Create a test HTML page with the widget
    const widgetHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <link rel="stylesheet" href="http://localhost:3000/widget.css">
      </head>
      <body>
        <div id="kudoswall-widget" data-project-id="test-project"></div>
        <script src="http://localhost:3000/widget.js"></script>
      </body>
      </html>
    `;
    
    await page.setContent(widgetHtml);
    
    // Wait for widget to load
    await page.waitForSelector('.kudoswall-widget', { timeout: 10000 });
    
    // Verify widget rendered
    await expect(page.locator('.kudoswall-widget')).toBeVisible();
  });
});
