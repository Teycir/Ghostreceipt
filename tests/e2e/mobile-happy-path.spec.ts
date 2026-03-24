import { test, expect } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

async function waitForHomeReady(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('.main-shell')).toHaveClass(/main-shell--ready/, {
    timeout: 25000,
  });
  await expect(page.locator('.startup-overlay')).toHaveClass(/startup-overlay--hidden/, {
    timeout: 25000,
  });
}

test.describe('Mobile happy path', () => {
  test('navigates home -> history -> verify -> home on a mobile viewport', async ({ page }) => {
    await page.goto('/');
    await waitForHomeReady(page);

    await expect(
      page.getByRole('button', { name: 'View Receipt History' })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /^Add/ })).toBeVisible();
    await expect(page.getByLabel('Receipt Label')).toHaveCount(0);

    await page.getByRole('button', { name: 'View Receipt History' }).click();
    await expect(page).toHaveURL('/history');
    await expect(page.locator('text=Local Receipt History')).toBeVisible();

    await page.getByRole('link', { name: 'Open receipt verification page' }).click();
    await expect(page).toHaveURL('/verify');
    await expect(page.locator('text=Payment Receipt Verification')).toBeVisible();

    await page.getByRole('button', { name: '← Generate New Receipt' }).click();
    await expect(page).toHaveURL('/');
    await waitForHomeReady(page);

    const hasHorizontalOverflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 1;
    });
    expect(hasHorizontalOverflow).toBe(false);
  });
});
