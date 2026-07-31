import { test, expect } from '@playwright/test';
import { SEL, activateInspector, deactivateInspector, captureElement, activateFreeze } from './helpers';

test.describe('vanilla example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('toolbar appears after first activation and persists', async ({ page }) => {
    // Toolbar exists at startup for the Capture mode affordance, but remains hidden until activation.
    await expect(page.locator(SEL.toolbar)).toBeAttached();
    await expect(page.locator(SEL.toolbar)).toHaveClass(/point-grab-toolbar-hidden/);
    await expect(page.getByRole('button', { name: 'Start Capture Mode' })).toBeVisible();
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
    await expect(toast).toContainText('Confirmed & copied');
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
    await expect(toast).toContainText('Confirmed & copied');
  });

  test('capturing a queue item captures correct HTML', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await activateInspector(page);
    await page.locator('.queue-item').first().hover();
    await expect(page.locator(SEL.overlay)).toBeVisible();
    await page.locator('.queue-item').first().click();
    await page.getByRole('textbox', { name: 'What should change about this element?' }).fill('Keep the captured markup intact.');
    await page.getByRole('button', { name: 'Accept' }).click();
    await deactivateInspector(page);
    await expect(page.locator(SEL.toastVisible)).toBeVisible({ timeout: 8_000 });
    const clipText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipText).toMatch(/<[a-z]/);
  });

  test('quest list reflects the real capture-session lifecycle and aggregate prompt', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await expect(page.getByTestId('quest-list')).toBeVisible();
    await page.getByRole('button', { name: 'Start Capture Mode' }).click();
    await expect(page.getByRole('button', { name: /End Capture Mode/ })).toBeVisible();

    await page.locator('.queue-item').first().click();
    await page.getByRole('textbox', { name: 'What should change about this element?' }).fill('Keep this queue item visible.');
    await page.getByRole('button', { name: 'Accept' }).click();
    await expect(page.locator('[data-quest-id="queue-comment"]')).toHaveAttribute('aria-checked', 'true');

    await page.locator('.progress-track').click();
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.locator('[data-quest-id="progress-skip"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('button', { name: /End Capture Mode/ })).toBeVisible();

    await page.locator('.volume-wrap').click();
    await page.getByRole('textbox', { name: 'What should change about this element?' }).fill('Make the volume control easier to scan.');
    await page.getByRole('button', { name: 'Accept' }).click();
    await expect(page.locator('[data-quest-id="volume-comment"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('prompt-preview')).toContainText('Keep this queue item visible.');
    await expect(page.getByTestId('prompt-preview')).toContainText('Make the volume control easier to scan.');

    await page.getByRole('button', { name: /End Capture Mode/ }).click();
    await expect(page.locator('[data-quest-id="end-review"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('walkthrough-complete')).toHaveText('2 reviewed elements + comments are ready for your AI agent.');
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    await expect(page.getByTestId('prompt-preview')).toHaveText(clipboard);
  });

  test('opens an accepted marker for review and renumbers markers after deletion', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.keyboard.press('Control+Shift+C');

    for (const [target, comment] of [
      [page.locator('.queue-item').first(), 'First review comment.'],
      [page.locator('.queue-item').nth(1), 'Second review comment.'],
    ] as const) {
      await target.click();
      await page.getByRole('textbox', { name: 'What should change about this element?' }).fill(comment);
      await page.getByRole('button', { name: 'Accept' }).click();
    }

    await page.locator('[data-point-grab-marker="1"]').hover();
    await expect(page.getByRole('textbox', { name: 'What should change about this element?' })).toHaveValue('First review comment.');
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator('[data-point-grab-marker="1"]')).toBeVisible();
    await expect(page.locator('[data-point-grab-marker="2"]')).toHaveCount(0);
  });
});
