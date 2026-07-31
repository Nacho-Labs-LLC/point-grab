// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from '../store';
import type { PointGrabOptions } from '../types';
import { createToolbarRenderer } from '../toolbar/toolbar-renderer';

const options: PointGrabOptions = {
  activationKey: 'Ctrl+C',
  activationMode: 'toggle',
  keyHoldDuration: 0,
  maxContextLines: 20,
  enabled: true,
  enableInInputs: false,
  devOnly: false,
  showToolbar: true,
  themeMode: 'dark',
  mcpWebhook: false,
  classFilters: [],
  htmlCleaners: [],
};

describe('capture-session toolbar', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>';
  });

  it('shows an explicit End Capture Mode action before the first captured comment', () => {
    const toolbar = createToolbarRenderer({
      onSelectionMode: vi.fn(),
      onHistory: vi.fn(),
      onActions: vi.fn(),
      onFreeze: vi.fn(),
      onThemeToggle: vi.fn(),
      onEnableToggle: vi.fn(),
      onDismiss: vi.fn(),
      onCopyPrompt: vi.fn(),
    });
    const store = createStore(options);

    toolbar.show();
    toolbar.update(store.state, 0, true);

    const endButton = document.querySelector('[data-point-grab-btn="copyPrompt"]') as HTMLButtonElement;
    expect(endButton).not.toBeNull();
    expect(endButton.style.display).not.toBe('none');
    expect(endButton.textContent).toContain('End Capture Mode');
  });

  it('exposes a subtle bottom capture-mode affordance while inactive', () => {
    const toolbar = createToolbarRenderer({
      onSelectionMode: vi.fn(), onHistory: vi.fn(), onActions: vi.fn(), onFreeze: vi.fn(),
      onThemeToggle: vi.fn(), onEnableToggle: vi.fn(), onDismiss: vi.fn(), onCopyPrompt: vi.fn(),
    });
    const store = createStore(options);

    toolbar.show();
    toolbar.update(store.state, 0, false);

    expect(document.querySelector('[data-point-grab-btn="captureHint"]')?.textContent).toContain('Capture mode');
  });
});
