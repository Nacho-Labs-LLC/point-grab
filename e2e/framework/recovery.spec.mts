import {
  test, expect, framework, profile, openApp, toolbarButton, overlay, freezeLayer, toast,
  chooseAction, pick, holdGrab, clipboard, setClipboard,
} from './fixtures.mts';
import { checkpoint } from '../checkpoint';

test.beforeEach(async ({ page, errors }) => { void errors; await openApp(page); });

test('recovery: Copy Element pending pick retains the real snippet for history re-copy', async ({ page }) => {
  await chooseAction(page, 'Copy Element');
  await pick(page, profile.target(page));
  await expect(toast(page)).toContainText('Copied to clipboard');
  const original = await clipboard(page);
  expect(original).not.toBe('');
  await checkpoint(page, 'pending-copy-element-succeeded');
  await toolbarButton(page, 'history').click();
  const history = page.getByRole('dialog', { name: 'Inspection history', exact: true });
  await expect(history.locator('.point-grab-history-item')).toHaveCount(1);
  await checkpoint(page, 'pending-copy-element-history-row');
  await setClipboard(page, 'history sentinel');
  await history.locator('.point-grab-history-item').click();
  await expect(toast(page)).toContainText('Re-copied');
  await expect.poll(() => clipboard(page)).toBe(original);
  await test.info().attach('pending-action-history-real-output', { body: await clipboard(page), contentType: 'text/plain' });
  await checkpoint(page, 'pending-copy-element-history-recopied');
  test.info().annotations.push({ type: 'coverage', description: 'history-pending-recopy' });
});

test('recovery: Add Comment after an ordinary grab can continue picking a second element', async ({ page }) => {
  await holdGrab(page, profile.target(page));
  await expect(toast(page)).toContainText('Copied to clipboard');
  await chooseAction(page, 'Add Comment');
  const editor = page.getByRole('dialog', { name: 'Add comment', exact: true });
  await editor.getByRole('textbox').fill(`${framework}: selected target first`);
  await editor.getByRole('button', { name: 'Add to Review' }).click();
  await expect(toolbarButton(page, 'selection')).toHaveClass(/point-grab-btn-active/);
  await checkpoint(page, 'selected-target-comment-queued-picker-reactivated');
  await pick(page, profile.second(page));
  await expect(editor).toBeVisible();
  await editor.getByRole('textbox').fill(`${framework}: picked target second`);
  await checkpoint(page, 'second-target-comment-after-selected-target');
  await editor.getByRole('button', { name: 'Add to Review' }).click();
  await toolbarButton(page, 'copyPrompt').click();
  await expect.poll(() => clipboard(page)).toContain(`${framework}: picked target second`);
  const output = await clipboard(page);
  expect(output).toContain(`${framework}: selected target first`);
  await test.info().attach('selected-then-picked-comment-output', { body: output, contentType: 'text/plain' });
  await checkpoint(page, 'selected-then-picked-comments-confirmed');
  test.info().annotations.push({ type: 'coverage', description: 'comments-continue-after-grab' });
});

test('recovery: disabled tool ignores F and keeps application usable until explicitly reenabled', async ({ page }) => {
  await toolbarButton(page, 'enable').click();
  await page.keyboard.press('f');
  await expect(freezeLayer(page)).not.toBeVisible();
  await expect(overlay(page)).not.toBeVisible();
  await checkpoint(page, 'disabled-F-does-not-freeze-page');
  await profile.interact(page);
  await toolbarButton(page, 'enable').click();
  await holdGrab(page, profile.target(page));
  await expect(toast(page)).toContainText('Copied to clipboard');
  await checkpoint(page, 'disabled-F-followed-by-reenable-and-real-grab');
  test.info().annotations.push({ type: 'coverage', description: 'disabled-keyboard' });
});

test('recovery: real text inputs including shadow fields keep F and Ctrl+B native', async ({ page }) => {
  const input = await profile.input(page);
  await input.fill('');
  await input.press('f');
  await expect(input).toHaveValue(framework === 'vue' ? 'F' : 'f');
  await expect(freezeLayer(page)).not.toBeVisible();
  await input.press('Control+b');
  await expect(toolbarButton(page, 'selection')).not.toHaveClass(/point-grab-btn-active/);
  await expect(overlay(page)).not.toBeVisible();
  await checkpoint(page, 'native-field-shortcuts-do-not-activate-grab-or-freeze');
  test.info().annotations.push({ type: 'coverage', description: 'native-input-shortcuts' });
});

test('recovery: denied clipboard confirmation preserves queued comments for a successful retry', async ({ page }) => {
  await chooseAction(page, 'Add Comment');
  await pick(page, profile.target(page));
  const editor = page.getByRole('dialog', { name: 'Add comment', exact: true });
  const comment = `${framework}: keep this work after denied clipboard`;
  await editor.getByRole('textbox').fill(comment);
  await editor.getByRole('button', { name: 'Add to Review' }).click();
  // Explicit permission-boundary failure, not a fabricated successful clipboard.
  await page.evaluate(() => {
    const original = navigator.clipboard.writeText.bind(navigator.clipboard);
    Object.assign(window, { restoreClipboardForTest: () => Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: original }) });
    Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: () => Promise.reject(new DOMException('Intentional test denial', 'NotAllowedError')) });
  });
  await toolbarButton(page, 'copyPrompt').click();
  await expect(toast(page)).toContainText('Failed to copy');
  await expect(toolbarButton(page, 'copyPrompt')).toHaveAccessibleName('Confirm & Copy 1 reviewed element');
  await checkpoint(page, 'intentional-clipboard-denial-queue-retained');
  await page.evaluate(() => (window as any).restoreClipboardForTest());
  await toolbarButton(page, 'copyPrompt').click();
  await expect.poll(() => clipboard(page)).toContain(comment);
  await expect(toolbarButton(page, 'copyPrompt')).not.toBeVisible();
  await test.info().attach('clipboard-retry-actual-output', { body: await clipboard(page), contentType: 'text/plain' });
  await checkpoint(page, 'clipboard-permission-recovery-comment-confirmed');
  test.info().annotations.push({ type: 'coverage', description: 'clipboard-denial-retry' });
});
