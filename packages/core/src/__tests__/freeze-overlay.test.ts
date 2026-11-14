// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createFreezeOverlay } from '../overlay/freeze-overlay';
let freeze = createFreezeOverlay();
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
afterEach(() => { freeze.dispose(); document.body.innerHTML = ''; document.head.innerHTML = ''; vi.restoreAllMocks(); freeze = createFreezeOverlay(); });
it('restores the original value when multiple mutations occur in one task', async () => {
  const target = document.createElement('div'); target.dataset.phase = 'original'; target.textContent = 'original'; document.body.append(target);
  freeze.show(); target.dataset.phase = 'one'; target.dataset.phase = 'two'; target.firstChild!.textContent = 'one'; target.firstChild!.textContent = 'two';
  await flush(); expect(target.dataset.phase).toBe('original'); expect(target.textContent).toBe('original');
  freeze.hide(); target.dataset.phase = 'resumed'; await flush(); expect(target.dataset.phase).toBe('resumed');
});
it('recursively pauses open-shadow animations once and restores only uncancelled running animations', () => {
  const host = document.createElement('section'); document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  const nestedHost = document.createElement('div'); root.append(nestedHost);
  const nested = nestedHost.attachShadow({ mode: 'open' });
  const animation = (playState: string) => ({ playState, pause: vi.fn(), play: vi.fn() });
  const running = animation('running'), deep = animation('running'), paused = animation('paused');
  const cancelled = animation('running'), finished = animation('running');
  Object.defineProperty(document, 'getAnimations', { configurable: true, value: () => [] });
  Object.defineProperty(root, 'getAnimations', { configurable: true, value: () => [running, paused, cancelled, finished] });
  Object.defineProperty(nested, 'getAnimations', { configurable: true, value: () => [deep, running] });
  freeze.show(); freeze.show();
  expect(running.pause).toHaveBeenCalledTimes(1); expect(deep.pause).toHaveBeenCalledTimes(1);
  expect(paused.pause).not.toHaveBeenCalled();
  cancelled.playState = 'idle'; finished.playState = 'finished';
  freeze.hide(); freeze.dispose();
  expect(running.play).toHaveBeenCalledTimes(1); expect(deep.play).toHaveBeenCalledTimes(1);
  for (const untouched of [paused, cancelled, finished]) expect(untouched.play).not.toHaveBeenCalled();
  expect(document.querySelector('[id^="__point-grab-freeze"]')).toBeNull();
});
it('pauses running Web Animations and transitions, resuming only its own pauses', () => {
  const running = { playState: 'running', pause: vi.fn(), play: vi.fn() };
  const paused = { playState: 'paused', pause: vi.fn(), play: vi.fn() };
  Object.defineProperty(document, 'getAnimations', { configurable: true, value: () => [running, paused] });
  freeze.show(); freeze.show(); expect(running.pause).toHaveBeenCalledTimes(1); expect(paused.pause).not.toHaveBeenCalled();
  freeze.hide(); expect(running.play).toHaveBeenCalledTimes(1); expect(paused.play).not.toHaveBeenCalled();
});
