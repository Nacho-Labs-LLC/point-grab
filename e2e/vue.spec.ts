import { test, expect } from '@playwright/test';
import { SEL, activateInspector, deactivateInspector, captureElement, activateFreeze } from './helpers';

test.describe('vue example', () => {
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
    await page.locator('.product-name').hover();
    await expect(page.locator(SEL.overlay)).toBeVisible();
    await deactivateInspector(page);
    await expect(page.locator(SEL.overlay)).not.toBeVisible();
  });

  test('captures element and shows success toast', async ({ page }) => {
    const toast = await captureElement(page, page.locator('.product-name'));
    await expect(toast).toContainText('Copied to clipboard');
  });

  test('toast shows Vue component name', async ({ page }) => {
    const toast = await captureElement(page, page.locator('.product-name'));
    await expect(toast).toContainText('App');
  });

  test('capturing a size button includes source file', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    const toast = await captureElement(page, page.locator('.size-btn').first());
    await expect(toast).toContainText('App.vue');
  });

  test('freeze mode overlays the page', async ({ page }) => {
    await activateFreeze(page);
    await page.keyboard.press('f');
    await expect(page.locator(SEL.freeze)).not.toBeVisible();
    await deactivateInspector(page);
  });

  test('cart badge appears and is inspectable after adding to cart', async ({ page }) => {
    // Select color and size outside inspector mode, then add to cart
    await page.locator('.color-swatch').first().click();
    await page.locator('.size-btn').first().click();
    await page.locator('.add-to-cart-btn').click();
    await expect(page.locator('.cart-badge')).toBeVisible();
    // Close the cart drawer so it doesn't overlap the badge (drawer z-index > badge z-index)
    await page.locator('.cart-close').click();
    await expect(page.locator('.cart-drawer')).not.toBeVisible();
    const toast = await captureElement(page, page.locator('.cart-badge'));
    await expect(toast).toContainText('Copied to clipboard');
  });

  test('cart drawer opens and its items are inspectable', async ({ page }) => {
    await page.locator('.color-swatch').first().click();
    await page.locator('.size-btn').first().click();
    await page.locator('.add-to-cart-btn').click();
    await expect(page.locator('.cart-drawer')).toBeVisible();
    const toast = await captureElement(page, page.locator('.cart-item').first());
    await expect(toast).toContainText('Copied to clipboard');
  });

  test('clipboard content contains component stack', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await activateInspector(page);
    await page.locator('.product-name').hover();
    await expect(page.locator(SEL.overlay)).toBeVisible();
    await page.locator('.product-name').click();
    await deactivateInspector(page);
    await expect(page.locator(SEL.toastVisible)).toBeVisible({ timeout: 8_000 });
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toMatch(/in App/);
  });
});
