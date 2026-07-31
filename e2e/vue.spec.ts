import { test, expect } from '@playwright/test';

const SEL = {
  captureHint: '[data-point-grab-btn="captureHint"]',
  endCapture: '[data-point-grab-btn="copyPrompt"]',
  comment: '#__point-grab-comment-popover__',
} as const;

test.describe('Vue guided capture-session walkthrough', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  test('keeps a real session active across the reactive cart update and completes with its aggregate prompt', async ({ page }) => {
    await expect(page.getByText('Step 1 of 3')).toBeVisible();
    await expect(page.locator('.add-to-cart-btn')).toHaveClass(/walkthrough-target/);

    // Establish the second, reactive DOM state before capture starts.
    await page.locator('.color-swatch').first().click();
    await page.locator('.size-btn').first().click();
    await page.locator('.add-to-cart-btn').click();
    await expect(page.locator('.cart-total')).toBeVisible();
    // Close the interactive cart drawer before targeting the underlying CTA.
    await page.locator('.cart-overlay').click();

    await page.locator(SEL.captureHint).click();
    await page.locator('[data-point-grab-btn="actions"]').click();
    await page.getByRole('menuitem', { name: 'Add Comment' }).click();
    await page.locator('.add-to-cart-btn').click();
    await page.locator(`${SEL.comment} textarea`).fill('Explain why this action needs a selected color and size.');
    await page.locator(`${SEL.comment} button`, { hasText: 'Accept' }).click();

    await expect(page.getByText('Step 2 of 3')).toBeVisible();
    await expect(page.getByTestId('prompt-preview')).toContainText('selected color and size');

    await page.locator('.cart-total').click();
    await page.locator(`${SEL.comment} button`, { hasText: 'Skip' }).click();
    await expect(page.getByText('Step 3 of 3')).toBeVisible();
    await expect(page.locator(SEL.endCapture)).toHaveAccessibleName(/End Capture Mode/);

    await page.locator('.cart-total').click();
    await page.locator(`${SEL.comment} textarea`).fill('Keep the total pinned to the checkout action.');
    await page.locator(`${SEL.comment} button`, { hasText: 'Accept' }).click();

    await expect(page.getByText('Step 3 of 3')).toBeVisible();
    await expect(page.getByTestId('prompt-preview')).toContainText('## Element 2');

    await page.locator(SEL.endCapture).click();
    await expect(page.getByTestId('walkthrough-complete')).toBeVisible();
    await expect(page.getByTestId('walkthrough-complete')).toContainText('2 reviewed elements + comments are ready for your AI agent.');

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    await expect(page.getByTestId('prompt-preview')).toHaveText(clipboard);
    expect(clipboard).toContain('App.vue');
    expect(clipboard).toContain('selected color and size');
    expect(clipboard).toContain('Keep the total pinned to the checkout action.');
  });
});
