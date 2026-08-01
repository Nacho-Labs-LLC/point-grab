import { test, expect } from '@playwright/test';
import { activateInspector, activateFreeze, addToReview, addWithoutComment, copyElement, endAndCopyBatch, SEL } from './helpers';

test.describe('vanilla example', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('uses the V1 Copy Element fast path with compact element context', async ({ page }) => {
    const clipboard = await copyElement(page, page.locator('.queue-item').first());
    expect(clipboard).toContain('<div.queue-title> in <div.queue-info>');
  });

  test('keeps capture active while adding reviewed elements and copies the batch', async ({ page }) => {
    await page.getByRole('button', { name: 'Start Capture Mode' }).click();
    await addToReview(page, page.locator('.queue-item').first(), 'Keep this queue item visible.');
    await addWithoutComment(page, page.locator('.progress-track'));
    await expect(page.locator(SEL.endBatch)).toHaveAccessibleName(/End & Copy Batch \(2\//);
    const clipboard = await endAndCopyBatch(page);
    await expect(page.getByTestId('walkthrough-complete')).toContainText('2 reviewed elements');
    expect(clipboard).toContain('Keep this queue item visible.');
  });

  test('freeze mode overlays the page while capture mode is active', async ({ page }) => {
    await activateFreeze(page);
    await expect(page.locator(SEL.freeze)).toBeVisible();
  });
});
