// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createKeyboardHandler, parseKeyCombo } from '../keyboard/keyboard-handler';

let handler: ReturnType<typeof createKeyboardHandler>;
afterEach(() => { handler?.dispose(); document.body.innerHTML = ''; vi.restoreAllMocks(); });

function start(combo: string) {
  const onActivate = vi.fn(), onDeactivate = vi.fn();
  handler = createKeyboardHandler({ getActivationKey: () => combo, getActivationMode: () => 'hold', getKeyHoldDuration: () => 0, getEnableInInputs: () => false, onActivate, onDeactivate, isActive: () => false });
  handler.start();
  return { onActivate, onDeactivate };
}
const press = (init: KeyboardEventInit) => document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
const release = (init: KeyboardEventInit) => document.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, ...init }));

it('parses combos, aliases and the plus key; rejects combos without exactly one key', () => {
  expect(parseKeyCombo('Ctrl+Shift+X')).toEqual({ key: 'x', ctrl: true, shift: true, meta: false, alt: false });
  expect(parseKeyCombo('cmd + space')).toMatchObject({ key: ' ', meta: true });
  expect(parseKeyCombo('Ctrl++')).toMatchObject({ key: '+', ctrl: true });
  expect(parseKeyCombo('Ctrl+Shift')).toBeNull();
  expect(parseKeyCombo('Ctrl+A+B')).toBeNull();
  expect(parseKeyCombo('')).toBeNull();
});

it('Option/Alt combos match by physical key even when the character changes (macOS "©")', () => {
  const { onActivate, onDeactivate } = start('Alt+G');
  press({ key: '©', code: 'KeyG', altKey: true });
  expect(onActivate).toHaveBeenCalledOnce();
  release({ key: '©', code: 'KeyG' });
  expect(onDeactivate).toHaveBeenCalledOnce();
});

it('Shift+digit matches although the key produces a symbol', () => {
  const { onActivate } = start('Ctrl+Shift+1');
  press({ key: '!', code: 'Digit1', ctrlKey: true, shiftKey: true });
  expect(onActivate).toHaveBeenCalledOnce();
});

it('modifiers must match exactly: Ctrl+C leaves Ctrl+Shift+C (DevTools inspect) alone', () => {
  const { onActivate } = start('Ctrl+C');
  const devtools = new KeyboardEvent('keydown', { key: 'C', code: 'KeyC', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true });
  document.dispatchEvent(devtools);
  expect(onActivate).not.toHaveBeenCalled();
  expect(devtools.defaultPrevented).toBe(false);
  press({ key: 'c', code: 'KeyC', ctrlKey: true });
  expect(onActivate).toHaveBeenCalledOnce();
});

it('an invalid combo warns once and never activates', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { onActivate } = start('Ctrl+Shift');
  press({ key: 'Shift', ctrlKey: true, shiftKey: true });
  press({ key: 'Shift', ctrlKey: true, shiftKey: true });
  expect(onActivate).not.toHaveBeenCalled();
  expect(warn).toHaveBeenCalledOnce();
  expect(warn.mock.calls[0][0]).toContain('"Ctrl+Shift"');
});

it('a custom freezeKey toggles Freeze and relabels the toolbar button', async () => {
  const { init } = await import('../grab');
  const api = init({ mcpWebhook: false, devOnly: false, freezeKey: 'P' });
  api.showToolbar();
  const button = document.querySelector('[data-point-grab-btn="freeze"]')!;
  expect(button.getAttribute('aria-label')).toBe('Freeze page (P)');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', code: 'KeyF', bubbles: true, cancelable: true }));
  expect(document.getElementById('__point-grab-freeze-overlay__')).toBeNull();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', code: 'KeyP', bubbles: true, cancelable: true }));
  expect(document.getElementById('__point-grab-freeze-overlay__')).not.toBeNull();
  api.setOptions({ freezeKey: 'G' });
  expect(button.getAttribute('aria-label')).toBe('Freeze page (G)');
  api.dispose();
});
