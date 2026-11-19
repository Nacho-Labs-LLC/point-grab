import { type Locator, type Page } from '@playwright/test';
import {
  test, expect, framework, profile, openApp, toolbarButton, freezeLayer, overlay,
  chooseAction, pick, clipboard, toast, transformOf,
} from './fixtures.mts';
import { checkpoint } from '../checkpoint';

// Read real motion at multiple times, not merely the presence of a Freeze overlay.
async function motionSamples(page: Page, target: Locator, phase: string, frozen: boolean) {
  const samples = [await transformOf(target)];
  await checkpoint(page, `${phase}-start`);
  await page.waitForTimeout(600);
  samples.push(await transformOf(target));
  await checkpoint(page, `${phase}-end`);
  if (frozen) expect(samples[1], phase).toBe(samples[0]);
  else expect(samples[1], phase).not.toBe(samples[0]);
  if (process.env.POINT_GRAB_EVIDENCE_DIR) {
    await test.info().attach(`${phase}-measured-transforms`, { body: JSON.stringify({ phase, frozen, samples }, null, 2), contentType: 'application/json' });
  }
}

test.beforeEach(async ({ page, errors }) => {
  void errors;
  await openApp(page);
});

test('full Freeze: toolbar pauses real animation, second click resumes, keyboard repeats and Escape exits', async ({ page }) => {
  const motion = page.getByTestId('motion-sample').first();
  // Scroll its stable wrapper/trigger, not the perpetually moving animated child.
  await page.getByTestId('freeze-trigger').first().scrollIntoViewIfNeeded();
  await motionSamples(page, motion, 'animation-running-before-freeze', false);
  const freeze = toolbarButton(page, 'freeze');
  await freeze.click();
  await expect(freezeLayer(page)).toBeVisible();
  await expect(freeze).toHaveClass(/point-grab-btn-active/);
  // Allow a final committed frame after the animation pause.
  await page.waitForTimeout(80);
  await motionSamples(page, motion, 'toolbar-animation-frozen', true);
  await freeze.click();
  await expect(freezeLayer(page)).not.toBeVisible();
  await expect(freeze).not.toHaveClass(/point-grab-btn-active/);
  await motionSamples(page, motion, 'toolbar-animation-resumed', false);
  await page.keyboard.press('f');
  await expect(freezeLayer(page)).toBeVisible();
  await page.waitForTimeout(80);
  await motionSamples(page, motion, 'keyboard-animation-frozen', true);
  await page.keyboard.press('f');
  await expect(freezeLayer(page)).not.toBeVisible();
  await motionSamples(page, motion, 'keyboard-animation-resumed', false);
  await page.keyboard.press('f');
  await expect(freezeLayer(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(freezeLayer(page)).not.toBeVisible();
  await expect(toolbarButton(page, 'selection')).not.toHaveClass(/point-grab-btn-active/);
  await motionSamples(page, motion, 'escape-animation-resumed-picker-off', false);
  test.info().annotations.push({ type: 'coverage', description: 'freeze-toolbar-keyboard' });
});

test('full Freeze: hover detail stays after pointer leaves; frozen selection accepts a comment and confirmation resumes motion', async ({ page }) => {
  const trigger = page.getByTestId('freeze-trigger').first();
  const detail = page.getByTestId('freeze-popover').first();
  const motion = page.getByTestId('motion-sample').first();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.hover();
  await expect(detail).toBeVisible();
  await checkpoint(page, 'hover-detail-live-before-freezing');
  await page.keyboard.press('f');
  await expect(freezeLayer(page)).toBeVisible();
  await page.mouse.move(5, 5);
  await expect(detail).toBeVisible();
  await page.waitForTimeout(80);
  await motionSamples(page, motion, 'hover-detail-frozen-pointer-away', true);
  await chooseAction(page, 'Add Comment');
  // Frozen input intentionally hits the overlay; drive real pointer coordinates
  // instead of asking Locator.click() to bypass its interception.
  const box = (await detail.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(overlay(page)).toBeVisible();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const editor = page.getByRole('dialog', { name: 'Add comment', exact: true });
  await expect(editor).toBeVisible();
  const comment = `${framework}: preserve this hover detail`;
  await editor.getByRole('textbox').fill(comment);
  await checkpoint(page, 'comment-on-actually-frozen-hover-detail');
  await expect(freezeLayer(page)).toBeVisible();
  await editor.getByRole('button', { name: 'Add to Review' }).click();
  await expect(toolbarButton(page, 'copyPrompt')).toBeVisible();
  await checkpoint(page, 'frozen-hover-comment-queued');
  await toolbarButton(page, 'copyPrompt').click();
  await expect(toast(page)).toContainText('Confirmed & copied');
  await expect.poll(() => clipboard(page)).toContain(comment);
  if (process.env.POINT_GRAB_EVIDENCE_DIR) await test.info().attach('copied-frozen-hover-comment', { body: await clipboard(page), contentType: 'text/plain' });
  await expect(freezeLayer(page)).not.toBeVisible();
  await expect(overlay(page)).not.toBeVisible();
  await motionSamples(page, motion, 'confirm-comment-resumes-animation', false);
  test.info().annotations.push({ type: 'coverage', description: 'freeze-hover-comment' });
});

for (const exit of ['enable', 'selection', 'dismiss'] as const) {
  test(`full Freeze: ${exit} explicitly exits frozen grab state and restores usable application`, async ({ page }) => {
    const motion = page.getByTestId('motion-sample').first();
    await toolbarButton(page, 'freeze').click();
    await expect(freezeLayer(page)).toBeVisible();
    await page.waitForTimeout(80);
    await motionSamples(page, motion, `${exit}-before-exit-frozen`, true);
    await toolbarButton(page, exit).click();
    await expect(freezeLayer(page), `${exit} must release the visible page freeze`).not.toBeVisible();
    await expect(overlay(page)).not.toBeVisible();
    await motionSamples(page, motion, `${exit}-after-exit-live`, false);
    if (exit === 'enable') await toolbarButton(page, 'enable').click();
    await profile.interact(page);
    await checkpoint(page, `${exit}-application-interactive-after-freeze`);
    test.info().annotations.push({ type: 'coverage', description: `freeze-exit-${exit}` });
  });
}
