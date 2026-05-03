import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../store';
import type { PointGrabOptions } from '../types';

function makeOptions(overrides: Partial<PointGrabOptions> = {}): PointGrabOptions {
  return {
    activationKey: 'Meta+C',
    activationMode: 'hold',
    keyHoldDuration: 0,
    maxContextLines: 20,
    enabled: true,
    enableInInputs: false,
    devOnly: true,
    showToolbar: true,
    themeMode: 'dark',
    mcpWebhook: true,
    classFilters: [],
    htmlCleaners: [],
    ...overrides,
  };
}

describe('createStore', () => {
  it('creates state with correct default values', () => {
    const opts = makeOptions();
    const store = createStore(opts);

    expect(store.state.active).toBe(false);
    expect(store.state.frozen).toBe(false);
    expect(store.state.hoveredElement).toBeNull();
    expect(store.state.options).toBe(opts);
    expect(store.state.toolbar.visible).toBe(true);
    expect(store.state.toolbar.themeMode).toBe('dark');
    expect(store.state.toolbar.history).toEqual([]);
    expect(store.state.toolbar.pendingAction).toBeNull();
  });

  it('respects showToolbar=false in options', () => {
    const store = createStore(makeOptions({ showToolbar: false }));
    expect(store.state.toolbar.visible).toBe(false);
  });

  it('respects themeMode in options', () => {
    const store = createStore(makeOptions({ themeMode: 'light' }));
    expect(store.state.toolbar.themeMode).toBe('light');
  });

  it('notifies listeners on state changes', () => {
    const store = createStore(makeOptions());
    const listener = vi.fn();

    store.subscribe(listener);
    store.state.active = true;

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(store.state, 'active');
  });

  it('does not notify listeners when value has not changed', () => {
    const store = createStore(makeOptions());
    const listener = vi.fn();

    store.subscribe(listener);
    store.state.active = false; // same as default

    expect(listener).not.toHaveBeenCalled();
  });

  it('subscribe returns an unsubscribe function that works', () => {
    const store = createStore(makeOptions());
    const listener = vi.fn();

    const unsub = store.subscribe(listener);
    store.state.active = true;
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    store.state.active = false;
    expect(listener).toHaveBeenCalledTimes(1); // no additional call
  });

  it('supports multiple listeners', () => {
    const store = createStore(makeOptions());
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    store.subscribe(listener1);
    store.subscribe(listener2);
    store.state.frozen = true;

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  it('unsubscribing one listener does not affect others', () => {
    const store = createStore(makeOptions());
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    const unsub1 = store.subscribe(listener1);
    store.subscribe(listener2);

    unsub1();
    store.state.active = true;

    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  it('passes the proxy state and changed key to listeners', () => {
    const store = createStore(makeOptions());
    const listener = vi.fn();

    store.subscribe(listener);
    store.state.frozen = true;

    const [receivedState, receivedKey] = listener.mock.calls[0];
    expect(receivedKey).toBe('frozen');
    expect(receivedState.frozen).toBe(true);
  });
});
