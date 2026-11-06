// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { init } from '../grab';

let api: ReturnType<typeof init> | undefined;
afterEach(() => { api?.dispose(); document.body.innerHTML = ''; vi.restoreAllMocks(); });

it('offers explicit Screen Grab consent without requesting capture or sending on activation', () => {
  const getDisplayMedia = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia } });
  api = init({ mcpWebhook: false });
  api.setElementFromPoint(() => document.querySelector('[data-point-grab-btn="screenGrab"]'));
  api.activate();
  document.querySelector<HTMLButtonElement>('[data-point-grab-btn="screenGrab"]')?.click();
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Choose this tab');
  expect(getDisplayMedia).not.toHaveBeenCalled();
  expect(api.isActive()).toBe(false);
});
