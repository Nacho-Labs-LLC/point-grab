import { test, expect, type Locator, type Page } from '@playwright/test';
import { SEL } from './helpers';

async function toggleInspector(page: Page): Promise<void> {
  await page.keyboard.press('Control+Shift+C');
}

async function captureElement(page: Page, target: Locator): Promise<Locator> {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await toggleInspector(page);
  await target.hover();
  await expect(page.locator(SEL.overlay)).toBeVisible({ timeout: 5_000 });
  await target.click();
  await toggleInspector(page);
  const toast = page.locator(SEL.toastVisible);
  await expect(toast).toBeVisible({ timeout: 8_000 });
  return toast;
}

test.describe('angular example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('toolbar appears after first activation and persists', async ({ page }) => {
    await expect(page.locator(SEL.toolbar)).toHaveClass(/point-grab-toolbar-hidden/);
    await toggleInspector(page);
    await expect(page.locator(SEL.toolbar)).toBeVisible();
    await toggleInspector(page);
    await expect(page.locator(SEL.toolbar)).toBeVisible();
  });

  test('inspector toggles and shows overlay on hover', async ({ page }) => {
    await toggleInspector(page);
    await page.locator('.post-card').first().hover();
    await expect(page.locator(SEL.overlay)).toBeVisible();
    await toggleInspector(page);
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
    await toggleInspector(page);
    await page.keyboard.press('f');
    await expect(page.locator(SEL.freeze)).toBeVisible();
    await page.keyboard.press('f');
    await expect(page.locator(SEL.freeze)).not.toBeVisible();
    await toggleInspector(page);
  });

  test('guided walkthrough preserves a capture session across Skip and previews the two-comment aggregate prompt', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: 'Start guided capture' }).click();
    await page.getByRole('button', { name: 'Start Capture Mode' }).click();
    await page.getByRole('button', { name: 'Actions' }).click();
    await page.getByRole('menuitem', { name: 'Add Comment' }).click();

    const metric = page.locator('[data-walkthrough-target="metric-card"]');
    await metric.hover();
    await expect(page.locator(SEL.overlay)).toBeVisible();
    await metric.click();
    await page.getByRole('textbox', { name: 'What should change about this element?' }).fill('Make this metric easier to scan.');
    await page.getByRole('button', { name: 'Accept' }).click();

    const post = page.locator('[data-walkthrough-target="post-copy"]');
    await post.hover();
    await expect(page.locator(SEL.overlay)).toBeVisible();
    await post.click();
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.getByText('Step 3 of 3')).toBeVisible();

    const operatorNote = page.locator('[data-walkthrough-target="operator-note"]');
    await operatorNote.hover();
    await expect(page.locator(SEL.overlay)).toBeVisible();
    await operatorNote.click();
    await page.getByRole('textbox', { name: 'What should change about this element?' }).fill('Make this guidance easier to follow.');
    await page.getByRole('button', { name: 'Accept' }).click();

    await expect(page.locator('[data-walkthrough-preview]')).toContainText('## Element 2');
    await page.getByRole('button', { name: /End Capture Mode/ }).click();
    await expect(page.getByText('Walkthrough complete')).toBeVisible();
  });
});
