import { test, expect } from '@playwright/test';
import { SEL, activateInspector, deactivateInspector, captureElement, activateFreeze } from './helpers';

test.describe('react example', () => {
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
    await page.locator('.post').first().hover();
    await expect(page.locator(SEL.overlay)).toBeVisible();
    await deactivateInspector(page);
    await expect(page.locator(SEL.overlay)).not.toBeVisible();
  });

  test('captures element and shows success toast', async ({ page }) => {
    const toast = await captureElement(page, page.locator('.post').first());
    await expect(toast).toContainText('Copied to clipboard');
  });

  test('toast shows React component name', async ({ page }) => {
    const toast = await captureElement(page, page.locator('.post').first());
    // React fiber tree resolver should identify the Post/App component
    await expect(toast).toContainText('App');
  });

  test('capturing an element includes source file path', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    const toast = await captureElement(page, page.locator('.post-text').first());
    // In Vite dev mode, _debugSource provides file paths
    await expect(toast).toContainText('App.jsx');
  });

  test('freeze mode overlays the page', async ({ page }) => {
    await activateFreeze(page);
    await page.keyboard.press('f');
    await expect(page.locator(SEL.freeze)).not.toBeVisible();
    await deactivateInspector(page);
  });

  test('reply popover is inspectable after opening (transient element demo)', async ({ page }) => {
    // Open the reply popover by clicking the reply button (outside inspector mode)
    await page.locator('.reply-btn').first().click();
    await expect(page.locator('.reply-popover').first()).toBeVisible();
    // The reply input autofocuses — blur it so Ctrl+C reaches point-grab instead of the browser copy handler
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    // Now inspect the popover
    const toast = await captureElement(page, page.locator('.reply-popover').first());
    await expect(toast).toContainText('Copied to clipboard');
  });

  test('clipboard content contains HTML of captured element', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await activateInspector(page);
    await page.locator('.post').first().hover();
    await expect(page.locator(SEL.overlay)).toBeVisible();
    await page.locator('.post').first().click();
    await deactivateInspector(page);
    await expect(page.locator(SEL.toastVisible)).toBeVisible({ timeout: 8_000 });
    const text = await page.evaluate(() => navigator.clipboard.readText());
    // Hovering .post may capture a child element — verify we got some HTML
    expect(text).toMatch(/<[a-z]/);
  });
});
