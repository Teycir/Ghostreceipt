import path from 'node:path';
import { test, expect } from '@playwright/test';

test.describe('History import flow', () => {
  test('imports JSON history and renders imported receipt details', async ({ page }) => {
    const fixturePath = path.join(
      process.cwd(),
      'tests/e2e/fixtures/history-import-sample.json'
    );

    await page.goto('/history');
    await expect(page).toHaveURL('/history');
    await expect(page.locator('text=Local Receipt History')).toBeVisible();
    await expect(page.locator('text=No receipts saved yet.')).toBeVisible();

    await page.setInputFiles('input[type="file"]', fixturePath);

    await expect(
      page.locator('text=Imported 1 receipt. Ignored 1 invalid entry.')
    ).toBeVisible();
    await expect(page.locator('text=E2E Imported Receipt')).toBeVisible();
    await expect(page.locator('text=Category: Testing')).toBeVisible();
    await expect(page.locator('text=proof_e2e_import_receipt_001')).toBeVisible();
    await expect(page.locator('text=42000000')).toBeVisible();
  });
});
