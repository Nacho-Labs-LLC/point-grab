import { test, expect } from '@playwright/test';
import { activateFreeze, addToReview, addWithoutComment, copyElement, endAndCopyBatch, SEL } from './helpers';

test.describe('web-components example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => customElements.get('forge-app') !== undefined);
  });

  test('copies selected custom-element context with its compact component name', async ({ page }) => {
    const clipboard = await copyElement(page, page.locator('forge-app'));
    expect(clipboard).toContain('(ForgeApp)');
  });

  test('guided Shadow DOM capture adds reviewed elements from the contextual menu', async ({ page }) => {
    await page.getByRole('button', { name: 'Start Capture Mode' }).click();
    await addToReview(page, page.locator('forge-button').filter({ hasText: 'Deploy' }), 'Clarify the deploy action.');
    await addWithoutComment(page, page.locator('forge-badge[variant="success"]').first());
    const clipboard = await endAndCopyBatch(page);
    await expect(page.getByText('2 reviewed elements + comments are ready for your AI agent.')).toBeVisible();
    expect(clipboard).toContain('Clarify the deploy action.');
  });

  test('freeze mode overlays the page', async ({ page }) => { await activateFreeze(page); await expect(page.locator(SEL.freeze)).toBeVisible(); });
});
