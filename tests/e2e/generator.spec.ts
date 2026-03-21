import { test, expect } from '@playwright/test';

test.describe('GhostReceipt E2E Flow', () => {
  test('should load home page successfully', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.locator('h1')).toContainText('GhostReceipt');
    await expect(page.locator('text=Prove the payment. Keep the privacy.')).toBeVisible();
  });

  test('should display generator form with all fields', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.locator('label:has-text("Chain")')).toBeVisible();
    await expect(page.locator('label:has-text("Transaction Hash")')).toBeVisible();
    await expect(page.locator('label:has-text("Claimed Amount")')).toBeVisible();
    await expect(page.locator('label:has-text("Minimum Date")')).toBeVisible();
    await expect(page.locator('button:has-text("Generate Receipt")')).toBeVisible();
  });

  test('should validate empty form submission', async ({ page }) => {
    await page.goto('/');
    
    await page.click('button:has-text("Generate Receipt")');
    
    await expect(page.locator('text=Transaction hash is required')).toBeVisible();
    await expect(page.locator('text=Claimed amount is required')).toBeVisible();
    await expect(page.locator('text=Minimum date is required')).toBeVisible();
  });

  test('should validate invalid Bitcoin tx hash', async ({ page }) => {
    await page.goto('/');
    
    await page.selectOption('select', 'bitcoin');
    await page.fill('input[placeholder*="64 hex"]', 'invalid-hash');
    await page.fill('input[placeholder="Enter amount"]', '100000000');
    await page.fill('input[type="date"]', '2024-01-01');
    
    await page.click('button:has-text("Generate Receipt")');
    
    await expect(page.locator('text=Invalid Bitcoin transaction hash')).toBeVisible();
  });

  test('should validate invalid Ethereum tx hash', async ({ page }) => {
    await page.goto('/');
    
    await page.selectOption('select', 'ethereum');
    await page.fill('input[placeholder*="0x"]', 'invalid-hash');
    await page.fill('input[placeholder="Enter amount"]', '1000000000000000000');
    await page.fill('input[type="date"]', '2024-01-01');
    
    await page.click('button:has-text("Generate Receipt")');
    
    await expect(page.locator('text=Invalid Ethereum transaction hash')).toBeVisible();
  });

  test('should show paste button for tx hash', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.locator('button:has-text("📋 Paste")')).toBeVisible();
  });

  test('should switch between Bitcoin and Ethereum', async ({ page }) => {
    await page.goto('/');
    
    await page.selectOption('select', 'bitcoin');
    await expect(page.locator('text=(satoshis)')).toBeVisible();
    
    await page.selectOption('select', 'ethereum');
    await expect(page.locator('text=(wei)')).toBeVisible();
  });

  test('should display footer with links', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.locator('footer')).toBeVisible();
    await expect(page.locator('a:has-text("Teycir Ben Soltane")')).toBeVisible();
    await expect(page.locator('a:has-text("GitHub")')).toBeVisible();
    await expect(page.locator('a:has-text("How to Use")')).toBeVisible();
    await expect(page.locator('a:has-text("FAQ")')).toBeVisible();
    await expect(page.locator('a:has-text("Security")')).toBeVisible();
    await expect(page.locator('a:has-text("License")')).toBeVisible();
  });

  test('should navigate to static docs pages', async ({ page }) => {
    await page.goto('/');
    
    await page.click('a:has-text("How to Use")');
    await expect(page).toHaveURL('/docs/how-to-use.html');
    await expect(page.locator('h1')).toContainText('How to Use');
    
    await page.goto('/');
    await page.click('a:has-text("FAQ")');
    await expect(page).toHaveURL('/docs/faq.html');
    await expect(page.locator('h1')).toContainText('FAQ');
    
    await page.goto('/');
    await page.click('a:has-text("Security")');
    await expect(page).toHaveURL('/docs/security.html');
    await expect(page.locator('h1')).toContainText('Security');
    
    await page.goto('/');
    await page.click('a:has-text("License")');
    await expect(page).toHaveURL('/docs/license.html');
    await expect(page.locator('h1')).toContainText('License');
  });

  test('should handle form retry after error', async ({ page }) => {
    await page.goto('/');
    
    await page.selectOption('select', 'bitcoin');
    await page.fill('input[placeholder*="64 hex"]', 'a'.repeat(64));
    await page.fill('input[placeholder="Enter amount"]', '100000000');
    await page.fill('input[type="date"]', '2024-01-01');
    
    await page.click('button:has-text("Generate Receipt")');
    
    await page.waitForSelector('text=Fetching transaction', { timeout: 5000 });
    
    const errorVisible = await page.locator('button:has-text("Retry")').isVisible({ timeout: 30000 }).catch(() => false);
    
    if (errorVisible) {
      await page.click('button:has-text("Retry")');
      await expect(page.locator('button:has-text("Generate Receipt")')).toBeVisible();
    }
  });
});
