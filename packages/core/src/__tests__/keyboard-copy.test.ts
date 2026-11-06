// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createKeyboardHandler } from '../keyboard/keyboard-handler';
let handler: ReturnType<typeof createKeyboardHandler>;
afterEach(() => { handler?.dispose(); window.getSelection()?.removeAllRanges(); document.body.innerHTML = ''; });
it.each(['Ctrl+C', 'Meta+C'])('preserves normal selected-text copy for %s in toggle mode', (combo) => {
  document.body.textContent = 'Copy me';
  const range = document.createRange(); range.selectNodeContents(document.body); window.getSelection()!.addRange(range);
  const activate = vi.fn();
  handler = createKeyboardHandler({ getActivationKey: () => combo, getActivationMode: () => 'toggle', getKeyHoldDuration: () => 0, getEnableInInputs: () => false, onActivate: activate, onDeactivate: vi.fn(), isActive: () => false });
  handler.start();
  const down = new KeyboardEvent('keydown', { key: 'c', ctrlKey: combo === 'Ctrl+C', metaKey: combo === 'Meta+C', bubbles: true, cancelable: true });
  document.dispatchEvent(down);
  document.dispatchEvent(new KeyboardEvent('keyup', { key: 'c', bubbles: true }));
  expect(down.defaultPrevented).toBe(false);
  expect(activate).not.toHaveBeenCalled();
});
it('does not toggle on an unrelated C key release in an input', () => {
  const activate = vi.fn();
  handler = createKeyboardHandler({ getActivationKey: () => 'Ctrl+C', getActivationMode: () => 'toggle', getKeyHoldDuration: () => 0, getEnableInInputs: () => false, onActivate: activate, onDeactivate: vi.fn(), isActive: () => false });
  handler.start();
  const input = document.createElement('textarea'); document.body.append(input);
  input.dispatchEvent(new KeyboardEvent('keyup', { key: 'c', bubbles: true }));
  expect(activate).not.toHaveBeenCalled();
});
