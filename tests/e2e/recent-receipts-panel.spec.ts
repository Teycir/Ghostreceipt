import path from 'node:path';
import { test, expect } from '@playwright/test';

async function waitForHomeReady(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('.main-shell')).toHaveClass(/main-shell--ready/, {
    timeout: 25000,
  });
  await expect(page.locator('.startup-overlay')).toHaveClass(/startup-overlay--hidden/, {
    timeout: 25000,
  });
}

test.describe('Recent receipts quick panel', () => {
  test('shows imported receipt in generator quick panel', async ({ page }) => {
    const fixturePath = path.join(
      process.cwd(),
      'tests/e2e/fixtures/history-import-sample.json'
    );

    await page.goto('/history');
    await expect(page.locator('text=Local Receipt History')).toBeVisible();
    await page.setInputFiles('input[type="file"]', fixturePath);
    await expect(page.locator('text=Imported 1 receipt. Ignored 1 invalid entry.')).toBeVisible();

    await page.goto('/');
    await waitForHomeReady(page);

    await expect(page.locator('text=Recent receipts')).toBeVisible();
    await expect(page.locator('text=E2E Imported Receipt')).toBeVisible();
    await expect(page.locator('text=BTC - E2E Imported Receipt')).toBeVisible();
  });
});

