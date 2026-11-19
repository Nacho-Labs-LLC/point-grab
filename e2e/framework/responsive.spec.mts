import type { Locator, Page } from '@playwright/test';
import {
  test, expect, framework, profile, openApp, toolbar, toolbarButton, overlay, toast,
  chooseAction, pick, clipboard, openScreenshot, regionOf, dragRegion, reviewDialog,
  selectDialog, preview, transformOf, nextInspect,
} from './fixtures.mts';
import { checkpoint } from '../checkpoint';

async function withinViewport(page: Page, control: Locator) {
  const box = (await control.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
}

test.beforeEach(async ({ page, errors }) => { void errors; await openApp(page); });

test('phone controls: 360px Actions, light/dark, real comment, confirmation and history remain reachable', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload(); await profile.ready(page);
  await withinViewport(page, toolbar(page));
  await toolbarButton(page, 'theme').click();
  await expect(toolbar(page)).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await toolbarButton(page, 'actions').click();
  const menu = page.getByRole('menu', { name: 'Actions', exact: true });
  await expect(menu).toBeVisible();
  await withinViewport(page, menu);
  await checkpoint(page, 'phone-light-toolbar-and-actions');
  await menu.getByRole('menuitem', { name: 'Add Comment', exact: true }).click();
  await pick(page, profile.target(page));
  const editor = page.getByRole('dialog', { name: 'Add comment', exact: true });
  await expect(editor).toBeVisible();
  await withinViewport(page, editor);
  const comment = `${framework}: actual phone review`;
  await editor.getByRole('textbox').fill(comment);
  await checkpoint(page, 'phone-comment-editor-all-controls-visible');
  await editor.getByRole('button', { name: 'Add to Review' }).click();
  await toolbarButton(page, 'copyPrompt').scrollIntoViewIfNeeded();
  await withinViewport(page, toolbarButton(page, 'copyPrompt'));
  // Hit testing ignores pointer-events:none labels, so reachable alone is not
  // visually unobscured: the selector label must paint below the toolbar.
  const label = page.locator('#__point-grab-label__');
  if (await label.count()) {
    expect(Number(await toolbar(page).evaluate(el => getComputedStyle(el).zIndex)))
      .toBeGreaterThan(Number(await label.evaluate(el => getComputedStyle(el).zIndex)));
  }
  await checkpoint(page, 'phone-queued-confirmation-reachable');
  await toolbarButton(page, 'copyPrompt').click();
  await expect.poll(() => clipboard(page)).toContain(comment);
  await test.info().attach('phone-actual-confirmed-comment-output', { body: await clipboard(page), contentType: 'text/plain' });
  // Light -> system -> dark; include a real open history surface in each theme.
  await toolbarButton(page, 'theme').click(); await toolbarButton(page, 'theme').click();
  await expect(toolbar(page)).toHaveCSS('background-color', 'rgb(15, 23, 42)');
  await toolbarButton(page, 'history').click();
  const history = page.getByRole('dialog', { name: 'Inspection history', exact: true });
  await expect(history).toBeVisible();
  await withinViewport(page, history);
  await checkpoint(page, 'phone-dark-toolbar-and-history');
  test.info().annotations.push({ type: 'coverage', description: 'phone-controls' });
});

test('capture lifecycle: real pending acknowledgement locks controls; preview focus stays inside; success resumes and history recopies summary', async ({ page, mcp }) => {
  test.setTimeout(60_000);
  await profile.interact(page);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const region = await regionOf(page, profile.shot(page));
  const motion = page.getByTestId('motion-sample').first();
  await openScreenshot(page);
  await dragRegion(page, region);
  await expect(reviewDialog(page)).toBeVisible();
  const frozen = await transformOf(motion);
  await page.getByRole('textbox', { name: 'Comment', exact: true }).fill(`${framework}: pending send proof`);
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press(i % 2 ? 'Shift+Tab' : 'Tab');
    expect(await reviewDialog(page).evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  await checkpoint(page, 'capture-keyboard-focus-contained-in-preview');
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let requests = 0;
  await page.route('http://localhost:3456/inspect', async route => {
    requests++; await gate;
    await route.continue({ url: mcp.inspectUrl });
  });
  const response = nextInspect(page, mcp);
  try {
    await page.getByRole('button', { name: 'Send image + comment' }).click();
    await expect(reviewDialog(page).getByRole('status')).toHaveText('Sending…');
    for (const name of ['Retake', 'Cancel', 'Send image + comment']) {
      await expect(reviewDialog(page).getByRole('button', { name, exact: true })).toBeDisabled();
    }
    await page.keyboard.press('Escape');
    await expect(reviewDialog(page)).toBeVisible();
    expect(await transformOf(motion)).toBe(frozen);
    await checkpoint(page, 'capture-real-ack-pending-locked-controls');
  } finally { release(); }
  const ack = await (await response).json();
  expect(ack).toMatchObject({ success: true, imageAccepted: true });
  await expect(reviewDialog(page)).not.toBeVisible();
  expect(requests).toBe(1);
  await expect(toast(page)).toContainText('Screen Grab sent');
  await expect(toolbarButton(page, 'actions')).toBeFocused();
  await expect.poll(() => transformOf(motion)).not.toBe(frozen);
  await checkpoint(page, 'capture-acknowledged-focus-returned-animation-resumed');
  await toolbarButton(page, 'history').click();
  const history = page.getByRole('dialog', { name: 'Inspection history', exact: true });
  const item = history.locator('.point-grab-history-item').first();
  await expect(item).toContainText(`Screenshot ${region.width} × ${region.height}`);
  await checkpoint(page, 'capture-screenshot-history-before-recopy');
  await item.click();
  await expect.poll(() => clipboard(page)).toBe(`Screen Grab (${region.width} × ${region.height})\n\n${framework}: pending send proof`);
  await test.info().attach('screenshot-history-actual-text-summary-not-png', { body: await clipboard(page), contentType: 'text/plain' });
  await checkpoint(page, 'capture-history-recopied-summary');
  test.info().annotations.push({ type: 'coverage', description: 'capture-pending-history' });
});

test('capture cancel: keyboard containment, Escape and Cancel return focus without sending', async ({ page, mcp }) => {
  const before = (await mcp.history()).entries.length;
  for (const exit of ['Escape', 'Cancel']) {
    const region = await regionOf(page, profile.shot(page));
    await openScreenshot(page);
    await dragRegion(page, region);
    await expect(reviewDialog(page)).toBeVisible();
    await expect(preview(page)).toBeVisible();
    await checkpoint(page, `capture-preview-before-${exit.toLowerCase()}`);
    if (exit === 'Escape') await page.keyboard.press('Escape');
    else await reviewDialog(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(selectDialog(page)).not.toBeVisible();
    await expect(reviewDialog(page)).not.toBeVisible();
    await expect(toolbarButton(page, 'actions')).toBeFocused();
    expect((await mcp.history()).entries).toHaveLength(before);
    await checkpoint(page, `capture-${exit.toLowerCase()}-focus-returned-without-send`);
  }
  test.info().annotations.push({ type: 'coverage', description: 'capture-cancel-focus' });
});
