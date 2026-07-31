import { test, expect } from '@playwright/test';

const SEL = {
  captureHint: '[data-point-grab-btn="captureHint"]',
  endCapture: '[data-point-grab-btn="copyPrompt"]',
  comment: '#__point-grab-comment-popover__',
} as const;

test.describe('site LiveDemo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  test('quest list reflects the real capture-session lifecycle and aggregate prompt', async ({ page }) => {
    await expect(page.getByTestId('quest-list')).toBeVisible();
    await page.locator(SEL.captureHint).click();

    await page.locator('#revenue-card').click();
    await page.locator(`${SEL.comment} textarea`).fill('Make Revenue the primary dashboard KPI.');
    await page.getByRole('button', { name: 'Accept' }).click();
    await expect(page.locator('[data-quest-id="revenue-comment"]')).toHaveAttribute('aria-checked', 'true');

    await page.locator('#fulfillment-card').click();
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.locator('[data-quest-id="fulfillment-skip"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator(SEL.endCapture)).toBeVisible();

    await page.locator('#notif-wrapper').click();
    await page.locator(`${SEL.comment} textarea`).fill('Make this notification easier to dismiss.');
    await page.getByRole('button', { name: 'Accept' }).click();
    await expect(page.locator('[data-quest-id="notification-comment"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('prompt-preview')).toContainText('## Element 2');

    await page.locator(SEL.endCapture).click();
    await expect(page.locator('[data-quest-id="end-review"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('walkthrough-complete')).toContainText('2 reviewed elements + comments are ready for your AI agent.');

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    await expect(page.getByTestId('prompt-preview')).toHaveText(clipboard);
    expect(clipboard).toContain('Make Revenue the primary dashboard KPI.');
    expect(clipboard).toContain('Make this notification easier to dismiss.');
  });
});
