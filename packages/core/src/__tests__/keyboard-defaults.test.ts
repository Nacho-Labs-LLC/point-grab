// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { init, type PointGrabAPI } from '../index';

let api: PointGrabAPI | null = null;

afterEach(() => {
  api?.dispose();
  api = null;
  document.documentElement.innerHTML = '<head></head><body></body>';
});

function dispatchShortcut(shiftKey: boolean): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, shiftKey, bubbles: true }));
  document.dispatchEvent(new KeyboardEvent('keyup', { key: 'c', ctrlKey: true, shiftKey, bubbles: true }));
}

describe('default activation shortcut', () => {
  it('uses Ctrl+Shift+C as a toggle and leaves ordinary Ctrl+C available for copy', () => {
    api = init({ devOnly: false, mcpWebhook: false });

    dispatchShortcut(false);
    expect(api.isActive()).toBe(false);

    dispatchShortcut(true);
    expect(api.isActive()).toBe(true);

    dispatchShortcut(true);
    expect(api.isActive()).toBe(false);
  });
});
