import { test, expect } from '@playwright/test';
import { SEL, activateInspector, deactivateInspector, captureElement, activateFreeze } from './helpers';

test.describe('web-components example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for custom elements to be defined and rendered
    await page.waitForFunction(() => customElements.get('forge-app') !== undefined);
  });

  test('toolbar appears after first activation and persists', async ({ page }) => {
    await expect(page.locator(SEL.toolbar)).toHaveClass(/point-grab-toolbar-hidden/);
    await activateInspector(page);
    await expect(page.locator(SEL.toolbar)).toBeVisible();
    await deactivateInspector(page);
    await expect(page.locator(SEL.toolbar)).toBeVisible();
  });

  test('inspector activates and shows overlay on hover', async ({ page }) => {
    await activateInspector(page);
    // Hover over the forge-app host element — shadow DOM traversal will pierce through
    await page.locator('forge-app').hover();
    await expect(page.locator(SEL.overlay)).toBeVisible();
    await deactivateInspector(page);
    await expect(page.locator(SEL.overlay)).not.toBeVisible();
  });

  test('captures forge-app host element and shows success toast', async ({ page }) => {
    const toast = await captureElement(page, page.locator('forge-app'));
    await expect(toast).toContainText('Copied to clipboard');
  });

  test('toast shows a custom element component name', async ({ page }) => {
    // The web-components resolver extracts names from custom element class names.
    // Hovering inside forge-app pierces into nested shadow DOM (e.g. forge-button, forge-badge).
    const box = await page.locator('forge-app').boundingBox();
    expect(box).not.toBeNull();

    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await activateInspector(page);
    // Move into the content area (below the 56px header)
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 80);
    await expect(page.locator(SEL.overlay)).toBeVisible({ timeout: 5_000 });
    await page.mouse.click(box!.x + box!.width / 2, box!.y + 80);
    await deactivateInspector(page);
    const toast = page.locator(SEL.toastVisible);
    await expect(toast).toBeVisible({ timeout: 8_000 });
    // Toast should contain "Component" label — any custom element was resolved
    await expect(toast).toContainText('Component');
  });

  test('freeze mode overlays the page', async ({ page }) => {
    await activateFreeze(page);
    await page.keyboard.press('f');
    await expect(page.locator(SEL.freeze)).not.toBeVisible();
    await deactivateInspector(page);
  });

  test('inspector works across shadow DOM boundaries', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    const forgeApp = page.locator('forge-app');
    const box = await forgeApp.boundingBox();
    expect(box).not.toBeNull();

    await activateInspector(page);
    // Move to a point well inside the forge-app content area (avoids point-grab toolbar at bottom)
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 100);
    await expect(page.locator(SEL.overlay)).toBeVisible({ timeout: 5_000 });
    await page.mouse.click(box!.x + box!.width / 2, box!.y + 100);
    await deactivateInspector(page);
    await expect(page.locator(SEL.toastVisible)).toBeVisible({ timeout: 8_000 });

    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text.length).toBeGreaterThan(0);
  });

  test('forge-badge inside shadow DOM is inspectable', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    const forgeApp = page.locator('forge-app');
    const box = await forgeApp.boundingBox();
    expect(box).not.toBeNull();

    await activateInspector(page);
    // forge-badge elements render in the Badges section inside forge-app's shadow DOM.
    // The header is 56px; forge-main padding is 40px; Buttons section is ~120px; Badges starts ~216px.
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 230);
    await expect(page.locator(SEL.overlay)).toBeVisible({ timeout: 5_000 });
    await page.mouse.click(box!.x + box!.width / 2, box!.y + 230);
    await deactivateInspector(page);
    await expect(page.locator(SEL.toastVisible)).toBeVisible({ timeout: 8_000 });
  });

  test('guided capture walkthrough preserves two Shadow DOM comments in order', async ({ page }) => {
    await page.getByRole('button', { name: 'Start Capture Mode' }).click();
    await expect(page.getByText('Step 1 of 3')).toBeVisible();
    await page.getByRole('button', { name: 'Actions' }).click();
    await page.getByRole('menuitem', { name: 'Add Comment' }).click();

    await page.locator('forge-button').filter({ hasText: 'Deploy' }).click();
    await page.getByRole('textbox', { name: 'What should change about this element?' }).fill('Clarify the deploy action.');
    await page.getByRole('button', { name: 'Accept' }).click();

    await page.locator('forge-badge[variant="success"]').first().click();
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.getByText('Step 3 of 3')).toBeVisible();

    await page.locator('forge-tooltip').filter({ hasText: 'Message' }).hover();
    await page.locator('forge-tooltip').filter({ hasText: 'Message' }).click();
    await page.getByRole('textbox', { name: 'What should change about this element?' }).fill('Keep this tooltip message concise.');
    await page.getByRole('button', { name: 'Accept' }).click();

    await expect(page.getByTestId('prompt-preview')).toContainText('Clarify the deploy action.');
    await expect(page.getByTestId('prompt-preview')).toContainText('Keep this tooltip message concise.');
    await page.getByRole('button', { name: /End Capture Mode/ }).click();
    await expect(page.getByText('2 reviewed elements + comments are ready for your AI agent.')).toBeVisible();
  });
});
