import { test, expect } from '@playwright/test';
import { SEL, activateInspector, deactivateInspector, captureElement, activateFreeze } from './helpers';

test.describe('vanilla example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('toolbar appears after first activation and persists', async ({ page }) => {
    // Toolbar starts hidden and appears on first Ctrl+C activation
    await expect(page.locator(SEL.toolbar)).not.toBeAttached();
    await activateInspector(page);
    await expect(page.locator(SEL.toolbar)).toBeVisible();
    await deactivateInspector(page);
    // Toolbar stays visible after releasing keys
    await expect(page.locator(SEL.toolbar)).toBeVisible();
  });

  test('inspector activates and shows overlay on hover', async ({ page }) => {
    await activateInspector(page);
    await page.locator('.queue-item').first().hover();
    await expect(page.locator(SEL.overlay)).toBeVisible();
    await deactivateInspector(page);
    await expect(page.locator(SEL.overlay)).not.toBeVisible();
  });

  test('captures element and shows success toast', async ({ page }) => {
    const toast = await captureElement(page, page.locator('.queue-item').first());
    await expect(toast).toContainText('Copied to clipboard');
  });

  test('no component name for vanilla JS (resolver not set)', async ({ page }) => {
    const toast = await captureElement(page, page.locator('.queue-item').first());
    // Toast should not contain a component row since no framework resolver is registered
    await expect(toast.locator('.point-grab-toast-row')).not.toBeAttached();
  });

  test('freeze mode overlays the page', async ({ page }) => {
    await activateFreeze(page);
    // Unfreeze
    await page.keyboard.press('f');
    await expect(page.locator(SEL.freeze)).not.toBeVisible();
    await deactivateInspector(page);
  });

  test('freeze mode is active while overlay is present', async ({ page }) => {
    await activateFreeze(page);
    // Freeze overlay should be in the DOM while frozen
    await expect(page.locator(SEL.freeze)).toBeVisible();
    await page.keyboard.press('f');
    await deactivateInspector(page);
  });

  test('progress track is inspectable while animating', async ({ page }) => {
    const toast = await captureElement(page, page.locator('.progress-track'));
    await expect(toast).toContainText('Copied to clipboard');
  });

  test('capturing a queue item captures correct HTML', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await activateInspector(page);
    await page.locator('.queue-item').first().hover();
    await expect(page.locator(SEL.overlay)).toBeVisible();
    await page.locator('.queue-item').first().click();
    await deactivateInspector(page);
    await expect(page.locator(SEL.toastVisible)).toBeVisible({ timeout: 8_000 });
    const clipText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipText).toMatch(/<[a-z]/);
  });
});
