import { test, expect } from '@playwright/test';

async function waitForAppReady(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('.main-shell')).toHaveClass(/main-shell--ready/, {
    timeout: 20000,
  });
  await expect(page.locator('.startup-overlay')).toHaveClass(/startup-overlay--hidden/, {
    timeout: 20000,
  });
}

async function selectChain(
  page: import('@playwright/test').Page,
  chainLabel: 'Bitcoin' | 'Ethereum'
): Promise<void> {
  const chainTrigger = page.locator('button[aria-haspopup="listbox"]').first();
  await chainTrigger.click();
  await page.getByRole('option', { name: chainLabel, exact: true }).click();
}

async function navigateViaFooterLink(
  page: import('@playwright/test').Page,
  label: string
): Promise<void> {
  const href = await page.locator(`a:has-text("${label}")`).first().getAttribute('href');
  if (!href) {
    throw new Error(`Footer link "${label}" is missing href`);
  }

  await page.goto(href);
}

async function fillMinimumAmount(
  page: import('@playwright/test').Page,
  amount: string
): Promise<void> {
  await page.getByLabel(/Minimum Amount/i).fill(amount);
}

test.describe('GhostReceipt E2E Flow', () => {
  test('should load home page successfully', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await expect(page.locator('h1')).toContainText('GhostReceipt');
    await expect(page.locator('label:has-text("Chain")')).toBeVisible();
  });

  test('should display generator form with all fields', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await expect(page.locator('label:has-text("Chain")')).toBeVisible();
    await expect(page.locator('label:has-text("Transaction Hash")')).toBeVisible();
    await expect(page.locator('label:has-text("Minimum Amount")')).toBeVisible();
    await expect(page.locator('label:has-text("Minimum Date")')).toBeVisible();
    await expect(page.locator('button:has-text("Generate Receipt")')).toBeVisible();
  });

  test('should validate empty form submission', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await page.click('button:has-text("Generate Receipt")');
    
    await expect(page.locator('text=Transaction hash is required')).toBeVisible();
    await expect(page.locator('text=Minimum amount is required')).toBeVisible();
    await expect(page.locator('text=Minimum date is required')).toBeVisible();
  });

  test('should validate invalid Bitcoin tx hash', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await selectChain(page, 'Bitcoin');
    await page.fill('input[placeholder*="64 hex"]', 'invalid-hash');
    await fillMinimumAmount(page, '100000000');
    await page.fill('input[type="date"]', '2024-01-01');
    
    await page.click('button:has-text("Generate Receipt")');
    
    await expect(page.locator('text=Invalid Bitcoin transaction hash')).toBeVisible();
  });

  test('should validate invalid Ethereum tx hash', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await selectChain(page, 'Ethereum');
    await page.fill('input[placeholder*="0x"]', 'invalid-hash');
    await fillMinimumAmount(page, '1000000000000000000');
    await page.fill('input[type="date"]', '2024-01-01');
    
    await page.click('button:has-text("Generate Receipt")');
    
    await expect(page.locator('text=Invalid Ethereum transaction hash')).toBeVisible();
  });

  test('should auto-detect chain from tx hash format', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    const txInput = page.locator('input[placeholder*="64 hex"]').first();
    await txInput.fill(`0x${'a'.repeat(64)}`);

    await expect(page.locator('input[placeholder*="0x + 64 hex characters"]')).toBeVisible();
    await expect(page.locator('text=✓ Auto-selected Ethereum transaction hash.')).toBeVisible();
  });

  test('should show paste button for tx hash', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await expect(page.locator('button:has-text("📋 Paste")')).toBeVisible();
  });

  test('should switch between Bitcoin and Ethereum', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await selectChain(page, 'Bitcoin');
    await expect(page.locator('text=(satoshis)')).toBeVisible();

    await selectChain(page, 'Ethereum');
    await expect(page.locator('text=(wei)')).toBeVisible();
  });

  test('should display footer with links', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await expect(page.locator('footer')).toBeVisible();
    await expect(page.locator('a:has-text("Made by Teycir")')).toBeVisible();
    await expect(page.locator('a:has-text("Source Code")')).toBeVisible();
    await expect(page.locator('a:has-text("How to Use")')).toBeVisible();
    await expect(page.locator('a:has-text("History")')).toBeVisible();
    await expect(page.locator('a:has-text("FAQ")')).toBeVisible();
    await expect(page.locator('a:has-text("Security")')).toBeVisible();
    await expect(page.locator('a:has-text("License")')).toBeVisible();
  });

  test('should navigate to local history page', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await navigateViaFooterLink(page, 'History');
    await expect(page).toHaveURL('/history');
    await expect(page.locator('text=Local Receipt History')).toBeVisible();
  });

  test('should navigate to static docs pages', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await navigateViaFooterLink(page, 'How to Use');
    await expect(page).toHaveURL('/docs/how-to-use.html');
    await expect(page.locator('h1')).toContainText('How to Use');
    
    await page.goto('/');
    await waitForAppReady(page);
    await navigateViaFooterLink(page, 'FAQ');
    await expect(page).toHaveURL('/docs/faq.html');
    await expect(page.locator('h1')).toContainText('Frequently Asked Questions');
    
    await page.goto('/');
    await waitForAppReady(page);
    await navigateViaFooterLink(page, 'Security');
    await expect(page).toHaveURL('/docs/security.html');
    await expect(page.locator('h1')).toContainText('Security');
    
    await page.goto('/');
    await waitForAppReady(page);
    await navigateViaFooterLink(page, 'License');
    await expect(page).toHaveURL('/docs/license.html');
    await expect(page.locator('h1')).toContainText('License');
  });

  test('should handle form retry after error', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await selectChain(page, 'Bitcoin');
    await page.fill('input[placeholder*="64 hex"]', 'a'.repeat(64));
    await fillMinimumAmount(page, '100000000');
    await page.fill('input[type="date"]', '2024-01-01');
    
    await page.click('button:has-text("Generate Receipt")');

    const retryButton = page.getByRole('button', { name: 'Try Again' });
    const successCard = page.locator('text=Receipt Generated');
    await Promise.race([
      retryButton.waitFor({ state: 'visible', timeout: 30000 }),
      successCard.waitFor({ state: 'visible', timeout: 30000 }),
    ]);

    if (await retryButton.isVisible()) {
      await retryButton.click();
      await expect(page.locator('button:has-text("Generate Receipt")')).toBeVisible();
    }
  });
});
