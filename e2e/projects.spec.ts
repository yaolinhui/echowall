import { test, expect } from '@playwright/test';

test.describe('Projects Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');
  });

  test('should display projects list', async ({ page }) => {
    await expect(page.locator('h1:has-text("Projects")')).toBeVisible();
    
    // Check for projects or empty state
    const hasProjects = await page.locator('.grid > div').count() > 0;
    const hasEmptyState = await page.locator('text=No projects yet').isVisible().catch(() => false);
    
    expect(hasProjects || hasEmptyState).toBeTruthy();
  });

  test('should create a new project', async ({ page }) => {
    // Click new project button
    await page.click('text=New Project');
    
    // Fill the form
    await page.fill('input[name="name"]', 'E2E Test Project');
    await page.fill('textarea[name="description"]', 'Created by E2E test');
    await page.fill('input[name="website"]', 'https://e2e-test.example.com');
    
    // Submit
    await page.click('button:has-text("Create")');
    
    // Verify project was created
    await expect(page.locator('text=E2E Test Project')).toBeVisible();
  });

  test('should navigate to project detail', async ({ page }) => {
    // Create a project first
    await page.click('text=New Project');
    await page.fill('input[name="name"]', 'Detail Test Project');
    await page.click('button:has-text("Create")');
    
    // Click on settings icon to go to detail page
    await page.locator('[data-testid="project-settings"]').first().click();
    
    // Should be on detail page
    await expect(page.locator('h1:has-text("Detail Test Project")')).toBeVisible();
    await expect(page.locator('text=Sources')).toBeVisible();
    await expect(page.locator('text=Widget')).toBeVisible();
  });

  test('should delete a project', async ({ page }) => {
    // Create a project
    await page.click('text=New Project');
    await page.fill('input[name="name"]', 'Delete Test Project');
    await page.click('button:has-text("Create")');
    
    // Verify it exists
    await expect(page.locator('text=Delete Test Project')).toBeVisible();
    
    // Delete it
    page.on('dialog', dialog => dialog.accept());
    await page.locator('[data-testid="delete-project"]').first().click();
    
    // Verify it's gone
    await expect(page.locator('text=Delete Test Project')).not.toBeVisible();
  });
});
