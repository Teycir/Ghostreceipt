import { test, expect } from '@playwright/test';

test.use({
  viewport: { width: 1280, height: 680 },
});

async function waitForHomeReady(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('.main-shell')).toHaveClass(/main-shell--ready/, {
    timeout: 25000,
  });
  await expect(page.locator('.startup-overlay')).toHaveClass(/startup-overlay--hidden/, {
    timeout: 25000,
  });
}

test.describe('Desktop form fit', () => {
  test('keeps generator page visible without forced vertical scrolling at short laptop viewport', async ({ page }) => {
    await page.goto('/');
    await waitForHomeReady(page);

    const hasVerticalOverflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollHeight > doc.clientHeight + 1;
    });
    expect(hasVerticalOverflow).toBe(false);

    await expect(page.getByRole('button', { name: 'Generate Receipt' })).toBeVisible();
  });
});
