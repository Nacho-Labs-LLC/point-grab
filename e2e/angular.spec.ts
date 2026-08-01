import { test, expect } from '@playwright/test';
import { activateFreeze, addToReview, addWithoutComment, copyElement, endAndCopyBatch, SEL } from './helpers';

test.describe('angular example', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('copies compact selected-element context with Angular component information', async ({ page }) => {
    const clipboard = await copyElement(page, page.locator('.post-copy').first());
    expect(clipboard).toContain('(PostCardComponent)');
  });

  test('guided capture uses contextual review actions and ends by copying the batch', async ({ page }) => {
    await page.getByRole('button', { name: 'Start guided capture' }).click();
    await page.getByRole('button', { name: 'Start Capture Mode' }).click();
    await addToReview(page, page.locator('[data-walkthrough-target="metric-card"]'), 'Make this metric easier to scan.');
    await addWithoutComment(page, page.locator('[data-walkthrough-target="post-copy"]'));
    await expect(page.getByText('Step 3 of 3')).toBeVisible();
    const clipboard = await endAndCopyBatch(page);
    await expect(page.getByText('Walkthrough complete')).toBeVisible();
    expect(clipboard).toContain('Make this metric easier to scan.');
  });

  test('freeze mode overlays the page', async ({ page }) => { await activateFreeze(page); await expect(page.locator(SEL.freeze)).toBeVisible(); });
});
