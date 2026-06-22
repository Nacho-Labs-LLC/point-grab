import { expect, type Page, type Locator } from '@playwright/test';

export const SEL = {
  toolbar: '#__point-grab-toolbar__',
  overlay: '#__point-grab-overlay__',
  toast: '#__point-grab-toast__',
  toastVisible: '#__point-grab-toast__.point-grab-toast-visible',
  freeze: '#__point-grab-freeze-overlay__',
} as const;

/** Hold Ctrl+C (Linux activation combo). Inspector activates immediately in hold mode. */
export async function activateInspector(page: Page): Promise<void> {
  await page.keyboard.down('Control');
  await page.keyboard.down('c');
}

/** Release Ctrl+C — deactivates inspector in hold mode. */
export async function deactivateInspector(page: Page): Promise<void> {
  await page.keyboard.up('c');
  await page.keyboard.up('Control');
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
