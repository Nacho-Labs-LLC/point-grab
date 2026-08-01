import { test, expect } from '@playwright/test';
import { addToReview, endAndCopyBatch, SEL } from './helpers';

const captureHint = '[data-point-grab-btn="captureHint"]';

test.describe('Vue guided capture-session walkthrough', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  test('keeps the V1 contextual menu workflow active across a reactive cart update', async ({ page }) => {
    await page.locator('.color-swatch').first().click();
    await page.locator('.size-btn').first().click();
    await page.locator('.add-to-cart-btn').click();
    await expect(page.locator('.cart-total')).toBeVisible();
    await page.locator('.cart-overlay').click();

    await page.locator(captureHint).click();
    await addToReview(page, page.locator('.add-to-cart-btn'), 'Explain why this action needs a selected color and size.');
    await expect(page.getByText('Step 2 of 3')).toBeVisible();
    await addToReview(page, page.locator('.cart-total'), 'Keep the total pinned to the checkout action.');
    await expect(page.getByText('Step 3 of 3')).toBeVisible();
    await expect(page.locator(SEL.endBatch)).toHaveAccessibleName(/End & Copy Batch \(2\//);

    const clipboard = await endAndCopyBatch(page);
    await expect(page.getByTestId('walkthrough-complete')).toContainText('2 reviewed elements');
    await expect(page.getByTestId('prompt-preview')).toHaveText(clipboard);
    expect(clipboard).toContain('(App at');
    expect(clipboard).toContain('selected color and size');
    expect(clipboard).toContain('Keep the total pinned to the checkout action.');
  });
});
