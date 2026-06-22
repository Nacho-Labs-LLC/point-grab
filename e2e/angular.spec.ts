import { test, expect } from '@playwright/test';
import { SEL, activateInspector, deactivateInspector, captureElement, activateFreeze } from './helpers';

test.describe('angular example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('toolbar appears after first activation and persists', async ({ page }) => {
    await expect(page.locator(SEL.toolbar)).not.toBeAttached();
    await activateInspector(page);
    await expect(page.locator(SEL.toolbar)).toBeVisible();
    await deactivateInspector(page);
    await expect(page.locator(SEL.toolbar)).toBeVisible();
  });

  test('inspector activates and shows overlay on hover', async ({ page }) => {
    await activateInspector(page);
    await page.locator('.post-card').first().hover();
    await expect(page.locator(SEL.overlay)).toBeVisible();
    await deactivateInspector(page);
    await expect(page.locator(SEL.overlay)).not.toBeVisible();
  });

  test('captures element and shows success toast', async ({ page }) => {
    const toast = await captureElement(page, page.locator('.post-card').first());
    await expect(toast).toContainText('Copied to clipboard');
  });

  test('toast shows Angular component name', async ({ page }) => {
    const toast = await captureElement(page, page.locator('.post-copy').first());
    await expect(toast).toContainText('PostCardComponent');
  });

  test('capturing a detail panel is inspectable after expanding the card', async ({ page }) => {
    await page.locator('.ghost-btn').first().click();
    const toast = await captureElement(page, page.locator('.detail-panel').first());
    await expect(toast).toContainText('PostCardComponent');
  });

  test('freeze mode overlays the page', async ({ page }) => {
    await activateFreeze(page);
    await page.keyboard.press('f');
    await expect(page.locator(SEL.freeze)).not.toBeVisible();
    await deactivateInspector(page);
  });
});
