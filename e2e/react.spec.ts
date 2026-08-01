import { test, expect } from '@playwright/test';
import { addToReview, endAndCopyBatch, SEL } from './helpers';

const captureHint = '[data-point-grab-btn="captureHint"]';

test.describe('React guided capture-session walkthrough', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  test('adds two selected elements with contextual review comments, then copies the V1 batch', async ({ page }) => {
    await expect(page.getByText('Step 1 of 3')).toBeVisible();
    await page.locator('.reply-btn').first().click();
    await expect(page.locator('.reply-popover').first()).toBeVisible();

    await page.locator(captureHint).click();
    await addToReview(page, page.locator('.post-actions').first(), 'Make the action row easier to scan.');
    await expect(page.getByText('Step 2 of 3')).toBeVisible();

    await addToReview(page, page.locator('.reply-popover').first(), 'Keep the reply composer visible while I write.');
    await expect(page.getByText('Step 3 of 3')).toBeVisible();
    await expect(page.locator(SEL.endBatch)).toHaveAccessibleName(/End & Copy Batch \(2\//);

    const clipboard = await endAndCopyBatch(page);
    await expect(page.getByTestId('prompt-preview')).toHaveText(clipboard);
    expect(clipboard).toContain('(Post at');
    expect(clipboard).toContain('Make the action row easier to scan.');
    expect(clipboard).toContain('Keep the reply composer visible while I write.');
  });
});
