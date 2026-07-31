import { expect, type Page, type Locator } from '@playwright/test';

export const SEL = {
  toolbar: '#__point-grab-toolbar__',
  overlay: '#__point-grab-overlay__',
  toast: '#__point-grab-toast__',
  toastVisible: '#__point-grab-toast__.point-grab-toast-visible',
  freeze: '#__point-grab-freeze-overlay__',
} as const;

/** Toggle the default Ctrl+Shift+C capture shortcut on. */
export async function activateInspector(page: Page): Promise<void> {
  await page.keyboard.press('Control+Shift+c');
}

/** Toggle the default Ctrl+Shift+C capture shortcut off. */
export async function deactivateInspector(page: Page): Promise<void> {
  await page.keyboard.press('Control+Shift+c');
}

/**
 * Full capture flow: activate → hover target → assert overlay → click → assert toast.
 * Returns the toast locator for further assertions.
 */
export async function captureElement(page: Page, target: Locator): Promise<Locator> {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await activateInspector(page);
  await target.hover();
  await expect(page.locator(SEL.overlay)).toBeVisible({ timeout: 5_000 });
  await target.click();
  await page.getByRole('textbox', { name: 'What should change about this element?' }).fill('Review this element.');
  await page.getByRole('button', { name: 'Accept' }).click();
  await deactivateInspector(page);
  const toast = page.locator(SEL.toastVisible);
  await expect(toast).toBeVisible({ timeout: 8_000 });
  return toast;
}

/** Activate inspector, press F to freeze, assert freeze overlay is visible. */
export async function activateFreeze(page: Page): Promise<void> {
  await activateInspector(page);
  await page.keyboard.press('f');
  await expect(page.locator(SEL.freeze)).toBeVisible({ timeout: 5_000 });
}
