import { test, expect } from '@playwright/test';

const SEL = { captureHint: '[data-point-grab-btn="captureHint"]', endCapture: '[data-point-grab-btn="copyPrompt"]', menu: '#__point-grab-actions-menu__' } as const;

test.describe('site LiveDemo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  test('reviews a commented element and an uncommented element, then copies the batch', async ({ page }) => {
    await page.locator(SEL.captureHint).click();
    await page.locator('#revenue-card').click();
    await page.getByRole('menuitem', { name: 'Add to Review…' }).click();
    await page.locator(`${SEL.menu} textarea`).fill('Make Revenue the primary dashboard KPI.');
    await page.getByRole('menuitem', { name: 'Add to batch' }).click();
    await expect(page.locator('[data-quest-id="revenue-comment"]')).toHaveAttribute('aria-checked', 'true');

    await page.locator('#fulfillment-card').click();
    await page.getByRole('menuitem', { name: 'Add to Review…' }).click();
    await page.getByRole('menuitem', { name: 'Add without comment' }).click();
    await expect(page.locator('[data-quest-id="fulfillment-batch"]')).toHaveAttribute('aria-checked', 'true');

    await page.locator(SEL.endCapture).click();
    await expect(page.locator('[data-quest-id="end-review"]')).toHaveAttribute('aria-checked', 'true');
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain('Make Revenue the primary dashboard KPI.');
    expect(clipboard).toContain('Comment:');
    expect(clipboard).not.toContain('<div class=');
  });

  test('copies computed styles and cleaned HTML from the selected element menu', async ({ page }) => {
    await page.locator(SEL.captureHint).click();
    await page.locator('#revenue-card').click();
    await page.getByRole('menuitem', { name: 'Copy Styles' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Computed styles');

    await page.locator('#revenue-card').click();
    await page.getByRole('menuitem', { name: 'Copy HTML' }).click();
    // Point-grab selects the deepest target under the click, so assert the copied revenue value rather than the card host.
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('$12,847');
  });
});
