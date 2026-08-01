// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from '../store';
import type { PointGrabOptions } from '../types';
import { createToolbarRenderer } from '../toolbar/toolbar-renderer';

const options: PointGrabOptions = { activationKey: 'Ctrl+C', activationMode: 'toggle', keyHoldDuration: 0, maxContextLines: 20, maxCaptureCount: 3, enabled: true, enableInInputs: false, devOnly: false, showToolbar: true, themeMode: 'dark', mcpWebhook: false, classFilters: [], htmlCleaners: [] };
const callbacks = () => ({ onSelectionMode: vi.fn(), onHistory: vi.fn(), onFreeze: vi.fn(), onThemeToggle: vi.fn(), onEnableToggle: vi.fn(), onDismiss: vi.fn(), onCopyPrompt: vi.fn() });

describe('capture-session toolbar', () => {
  beforeEach(() => { document.documentElement.innerHTML = '<head></head><body></body>'; });

  it('shows an End & Copy Batch count using the configured capture cap', () => {
    const toolbar = createToolbarRenderer(callbacks());
    const store = createStore({ ...options, maxCaptureCount: 5 });
    toolbar.show();
    toolbar.update(store.state, 2, true);
    expect(document.querySelector('[data-point-grab-btn="copyPrompt"]')?.textContent).toContain('End & Copy Batch (2/5)');
  });

  it('places active capture guidance above the toolbar and removes the element action ellipsis', () => {
    const toolbar = createToolbarRenderer(callbacks());
    const store = createStore(options);
    toolbar.show();
    toolbar.update(store.state, 0, true);
    const hint = document.querySelector('[data-point-grab-btn="captureHint"]');
    expect(hint?.textContent).toContain('Esc cancel');
    expect(hint?.textContent).toContain('F freeze');
    expect(hint?.textContent).toContain('Click for actions');
    expect(document.querySelector('[data-point-grab-btn="actions"]')).toBeNull();
  });
});
