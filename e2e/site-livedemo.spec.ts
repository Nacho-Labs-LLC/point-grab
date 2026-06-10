import { test, expect, type Locator, type Page } from '@playwright/test';
import { SEL, activateInspector, deactivateInspector } from './helpers';

async function captureElement(page: Page, target: Locator, opts?: { freeze?: boolean }) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

  await activateInspector(page);
  if (opts?.freeze) {
    await page.keyboard.press('f');
    await expect(page.locator(SEL.freeze)).toBeVisible({ timeout: 5_000 });
  }

  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;

  await page.mouse.move(x, y);
  await expect(page.locator(SEL.overlay)).toBeVisible({ timeout: 5_000 });
  await page.mouse.click(x, y);
  await deactivateInspector(page);
  const toast = page.locator(SEL.toastVisible);
  await expect(toast).toBeVisible({ timeout: 8_000 });
  return toast;
}

test.describe('site LiveDemo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#tour-instruction')).toContainText('Step 1 of 3');
  });

  test('full tour works, including freeze step unfreezing so the demo can advance', async ({ page }) => {
    test.setTimeout(60_000);

    await captureElement(page, page.locator('#progress-pct'));
    await expect(page.locator('#tour-chat')).toBeVisible();
    await expect(page.locator('#chat-progress-label')).toContainText('Step 1 of 3 complete');
    await expect(page.locator('#tour-continue-btn')).toBeVisible();

    await page.locator('#tour-continue-btn').click();
    await expect(page.locator('#tour-instruction')).toContainText('Step 2 of 3');
    await expect(page.locator('#freeze-hint')).toBeVisible();

    await captureElement(page, page.locator('#progress-bar'), { freeze: true });
    await expect(page.locator('#tour-chat')).toBeVisible();
    await expect(page.locator('#chat-progress-label')).toContainText('Step 2 of 3 complete');
    await expect(page.locator(SEL.freeze)).not.toBeVisible();
    await expect(page.locator('#tour-continue-btn')).toBeVisible();

    await page.locator('#tour-continue-btn').click();
    await expect(page.locator('#tour-instruction')).toContainText('Step 3 of 3');

    await page.locator('#notif-bell').click();
    await expect(page.locator('#notif-popover')).toBeVisible();
    await captureElement(page, page.locator('#notif-popover .flex.items-start').first());

    await expect(page.locator('#tour-complete')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#tour-complete')).toContainText('That’s the full flow');
  });
});
