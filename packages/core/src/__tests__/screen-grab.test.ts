// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { init } from '../grab';

let api: ReturnType<typeof init> | undefined;
afterEach(() => { api?.dispose(); document.body.innerHTML = ''; vi.restoreAllMocks(); });

it('offers live-page selection without requesting screen sharing or sending on activation', () => {
  const getDisplayMedia = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia } });
  api = init({ mcpWebhook: false });
  api.setElementFromPoint(() => document.querySelector('[data-point-grab-btn="actions"]'));
  api.activate();
  expect(document.querySelector('[data-point-grab-btn="screenGrab"]')).toBeNull();
  document.querySelector<HTMLButtonElement>('[data-point-grab-btn="actions"]')?.click();
  const menu = document.querySelector('[role="menu"]');
  expect([...menu!.querySelectorAll('[role="menuitem"]')].map((item) => item.textContent)).toEqual([
    'Copy Element', 'Copy Styles', 'Copy HTML', 'Add Comment', 'Add screenshot', 'Clear History',
  ]);
  const screenshot = [...menu!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((item) => item.textContent === 'Add screenshot')!;
  screenshot.focus(); screenshot.click();
  expect(menu!.classList.contains('point-grab-menu-visible')).toBe(false);
  expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Select current page region');
  expect(document.querySelector('input[type="file"]')).toBeNull();
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Drag directly on this page');
  expect(getDisplayMedia).not.toHaveBeenCalled();
  expect(api.isActive()).toBe(false);
  [...document.querySelectorAll('button')].find((item) => item.textContent === 'Cancel')!.click();
  expect(document.activeElement).toBe(document.querySelector('[data-point-grab-btn="actions"]'));
});
