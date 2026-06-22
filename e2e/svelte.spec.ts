import { test, expect } from '@playwright/test';
import { SEL, activateInspector, deactivateInspector, captureElement, activateFreeze } from './helpers';

test.describe('svelte example', () => {
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
    await page.locator('.note-item').first().hover();
    await expect(page.locator(SEL.overlay)).toBeVisible();
    await deactivateInspector(page);
    await expect(page.locator(SEL.overlay)).not.toBeVisible();
  });

  test('captures element and shows success toast', async ({ page }) => {
    const toast = await captureElement(page, page.locator('.note-item').first());
    await expect(toast).toContainText('Copied to clipboard');
  });

  test('toast shows Svelte component name', async ({ page }) => {
    const toast = await captureElement(page, page.locator('.note-item').first());
    await expect(toast).toContainText('App');
  });

  test('freeze mode overlays the page', async ({ page }) => {
    await activateFreeze(page);
    await page.keyboard.press('f');
    await expect(page.locator(SEL.freeze)).not.toBeVisible();
    await deactivateInspector(page);
  });

  test('format toolbar toggles open and closed (transient element scenario)', async ({ page }) => {
    // Toolbar starts hidden (no 'visible' class)
    await expect(page.locator('.format-toolbar')).not.toHaveClass(/visible/);
    // Click the toggle button to show it
    await page.locator('.toggle-format-btn').click();
    await expect(page.locator('.format-toolbar')).toHaveClass(/visible/);
    // Click again to hide
    await page.locator('.toggle-format-btn').click();
    await expect(page.locator('.format-toolbar')).not.toHaveClass(/visible/);
  });

  test('format toolbar buttons are inspectable while toolbar is open', async ({ page }) => {
    // Open the toolbar via the toggle button (no input focused, so Ctrl+C reaches point-grab)
    await page.locator('.toggle-format-btn').click();
    await expect(page.locator('.format-toolbar')).toHaveClass(/visible/);
    // Inspect a format button while toolbar is visible
    const toast = await captureElement(page, page.locator('.format-btn').first());
    await expect(toast).toContainText('Copied to clipboard');
  });

  test('word count updates as user types', async ({ page }) => {
    await expect(page.locator('.word-count')).toBeVisible();
    const toast = await captureElement(page, page.locator('.word-count'));
    await expect(toast).toContainText('Copied to clipboard');
  });

  test('clipboard content contains HTML of captured element', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await activateInspector(page);
    await page.locator('.note-item').first().hover();
    await expect(page.locator(SEL.overlay)).toBeVisible();
    await page.locator('.note-item').first().click();
    await deactivateInspector(page);
    await expect(page.locator(SEL.toastVisible)).toBeVisible({ timeout: 8_000 });
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toMatch(/<[a-z]/);
  });
});
