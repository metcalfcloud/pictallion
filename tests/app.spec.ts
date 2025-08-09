import { test, expect } from '@playwright/test';

test.describe('Pictallion App', () => {
  test('should load the main page', async ({ page }) => {
    await page.goto('/');
    
    // Check that the main heading is visible
    await expect(page.getByRole('heading', { name: 'Pictallion' })).toBeVisible();
    
    // Check that the description is visible
    await expect(page.getByText('Photo management application')).toBeVisible();
  });

  test('should have correct page title', async ({ page }) => {
    await page.goto('/');
    
    // Check page title
    await expect(page).toHaveTitle(/Pictallion/);
  });

  test('should render without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    
    // Wait a moment for any async operations
    await page.waitForTimeout(1000);
    
    // Check that there are no console errors
    expect(consoleErrors).toHaveLength(0);
  });
});