import { expect, type Locator, type Page } from '@playwright/test';

export const SEL = {
  toolbar: '#__point-grab-toolbar__',
  overlay: '#__point-grab-overlay__',
  toast: '#__point-grab-toast__',
  toastVisible: '#__point-grab-toast__.point-grab-toast-visible',
  freeze: '#__point-grab-freeze-overlay__',
  menu: '#__point-grab-actions-menu__',
  endBatch: '[data-point-grab-btn="copyPrompt"]',
} as const;

export async function activateInspector(page: Page): Promise<void> {
  await page.keyboard.press('Control+Shift+c');
}

export async function deactivateInspector(page: Page): Promise<void> {
  await page.keyboard.press('Control+Shift+c');
}

/** Select a target in capture mode and assert its anchored V1 action menu. */
export async function selectElement(page: Page, target: Locator): Promise<Locator> {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await target.hover();
  await expect(page.locator(SEL.overlay)).toBeVisible({ timeout: 5_000 });
  await target.click();
  const menu = page.getByRole('menu', { name: 'Selected element actions' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Copy Element' })).toBeVisible();
  return menu;
}

/** The V1 single-element fast path copies contextual element content immediately. */
export async function copyElement(page: Page, target: Locator): Promise<string> {
  await activateInspector(page);
  const menu = await selectElement(page, target);
  await menu.getByRole('menuitem', { name: 'Copy Element' }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).not.toBe('');
  return page.evaluate(() => navigator.clipboard.readText());
}

export async function addToReview(page: Page, target: Locator, comment: string): Promise<void> {
  const menu = await selectElement(page, target);
  await menu.getByRole('menuitem', { name: 'Add to Review…' }).click();
  const review = page.getByRole('textbox', { name: 'Review comment' });
  await review.fill(comment);
  await page.getByRole('menuitem', { name: 'Add to batch' }).click();
}

export async function addWithoutComment(page: Page, target: Locator): Promise<void> {
  const menu = await selectElement(page, target);
  await menu.getByRole('menuitem', { name: 'Add to Review…' }).click();
  await expect(page.getByRole('textbox', { name: 'Review comment' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Add without comment' }).click();
}

export async function endAndCopyBatch(page: Page): Promise<string> {
  const end = page.locator(SEL.endBatch);
  await expect(end).toHaveAccessibleName(/End & Copy Batch \(\d+\//);
  await end.click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).not.toBe('');
  return page.evaluate(() => navigator.clipboard.readText());
}

export async function activateFreeze(page: Page): Promise<void> {
  await activateInspector(page);
  await page.keyboard.press('f');
  await expect(page.locator(SEL.freeze)).toBeVisible({ timeout: 5_000 });
}
