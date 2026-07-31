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

test.describe('svelte example', () => {
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
    await page.locator('.note-item').first().hover();
    await expect(page.locator(SEL.overlay)).toBeVisible();
    await toggleInspector(page);
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
    await toggleInspector(page);
    await page.keyboard.press('f');
    await expect(page.locator(SEL.freeze)).toBeVisible();
    await page.keyboard.press('f');
    await expect(page.locator(SEL.freeze)).not.toBeVisible();
    await toggleInspector(page);
  });

  test('format toolbar toggles open and closed (transient element scenario)', async ({ page }) => {
    await expect(page.locator('.format-toolbar')).not.toHaveClass(/visible/);
    await page.locator('.toggle-format-btn').click();
    await expect(page.locator('.format-toolbar')).toHaveClass(/visible/);
    await page.locator('.toggle-format-btn').click();
    await expect(page.locator('.format-toolbar')).not.toHaveClass(/visible/);
  });

  test('format toolbar buttons are inspectable while toolbar is open', async ({ page }) => {
    await page.locator('.toggle-format-btn').click();
    await expect(page.locator('.format-toolbar')).toHaveClass(/visible/);
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
    await toggleInspector(page);
    await page.locator('.note-item').first().hover();
    await expect(page.locator(SEL.overlay)).toBeVisible();
    await page.locator('.note-item').first().click();
    await toggleInspector(page);
    await expect(page.locator(SEL.toastVisible)).toBeVisible({ timeout: 8_000 });
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toMatch(/<[a-z]/);
  });

  test('guided walkthrough preserves a capture session across Skip and previews the two-comment aggregate prompt', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: 'Start guided capture' }).click();
    await page.getByRole('button', { name: 'Start Capture Mode' }).click();
    await page.getByRole('button', { name: 'Actions' }).click();
    await page.getByRole('menuitem', { name: 'Add Comment' }).click();

    const title = page.locator('[data-walkthrough-target="note-title"]');
    await title.hover();
    await expect(page.locator(SEL.overlay)).toBeVisible();
    await title.click();
    await page.getByRole('textbox', { name: 'What should change about this element?' }).fill('Make the note title easier to scan.');
    await page.getByRole('button', { name: 'Accept' }).click();

    const body = page.locator('[data-walkthrough-target="note-body"]');
    await body.hover();
    await expect(page.locator(SEL.overlay)).toBeVisible();
    await body.click();
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.getByText('Step 3 of 3')).toBeVisible();

    const tags = page.locator('[data-walkthrough-target="note-tags"]');
    await tags.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await tags.hover();
    await expect(page.locator(SEL.overlay)).toBeVisible();
    await tags.click();
    await page.getByRole('textbox', { name: 'What should change about this element?' }).fill('Make these tags more distinct.');
    await page.getByRole('button', { name: 'Accept' }).click();

    await expect(page.locator('[data-walkthrough-preview]')).toContainText('## Element 2');
    await page.getByRole('button', { name: /End Capture Mode/ }).click();
    await expect(page.getByText('Walkthrough complete')).toBeVisible();
  });
});
