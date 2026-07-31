// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { showSelectFeedback } from '../overlay/select-feedback';

describe('showSelectFeedback', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('centers the copied pill using its rendered width', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
      bottom: 140,
      height: 40,
      left: 100,
      right: 200,
      toJSON: () => ({}),
      top: 100,
      width: 100,
      x: 100,
      y: 100,
    });
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get: () => 96,
    });

    showSelectFeedback(element);

    expect(document.querySelector<HTMLElement>('.point-grab-select-pill')?.style.left).toBe('102px');
  });
});
