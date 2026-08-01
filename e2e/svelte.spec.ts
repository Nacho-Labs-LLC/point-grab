import { test, expect } from '@playwright/test';
import { activateFreeze, addToReview, addWithoutComment, copyElement, endAndCopyBatch, SEL } from './helpers';

test.describe('svelte example', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('copies selected-element context with Svelte source information', async ({ page }) => {
    const clipboard = await copyElement(page, page.locator('.note-item').first());
    expect(clipboard).toContain('(App at src/App.svelte:');
  });

  test('guided flow adds a comment and an uncommented element through the selected menu', async ({ page }) => {
    await page.getByRole('button', { name: 'Start guided capture' }).click();
    await page.getByRole('button', { name: 'Start Capture Mode' }).click();
    await addToReview(page, page.locator('[data-walkthrough-target="note-title"]'), 'Make the note title easier to scan.');
    await addWithoutComment(page, page.locator('[data-walkthrough-target="note-body"]'));
    await expect(page.getByText('Step 3 of 3')).toBeVisible();
    const clipboard = await endAndCopyBatch(page);
    await expect(page.getByText('Walkthrough complete')).toBeVisible();
    expect(clipboard).toContain('Make the note title easier to scan.');
  });

  test('freeze mode overlays the page', async ({ page }) => { await activateFreeze(page); await expect(page.locator(SEL.freeze)).toBeVisible(); });
});
