import { describe, it, expect, vi } from 'vitest';
import { createPluginRegistry } from '../plugins/plugin-registry';
import type { Plugin, PointGrabAPI, ElementContext } from '../types';

function makeMockApi(): PointGrabAPI {
  return {
    activate: vi.fn(),
    deactivate: vi.fn(),
    toggle: vi.fn(),
    isActive: vi.fn(() => false),
    setOptions: vi.fn(),
    registerPlugin: vi.fn(),
    unregisterPlugin: vi.fn(),
    setComponentResolver: vi.fn(),
    setSourceResolver: vi.fn(),
    setElementFromPoint: vi.fn(),
    showToolbar: vi.fn(),
    hideToolbar: vi.fn(),
    setThemeMode: vi.fn(),
    getHistory: vi.fn(() => []),
    clearHistory: vi.fn(),
    dispose: vi.fn(),
  };
}

function makeContext(overrides: Partial<ElementContext> = {}): ElementContext {
  return {
    element: null as any,
    html: '<div>test</div>',
    componentName: null,
    filePath: null,
    line: null,
    column: null,
    componentStack: [],
    selector: 'div',
    cssClasses: [],
    textContent: null,
    ariaLabel: null,
    role: null,
    elementDescription: null,
    ...overrides,
  };
}

describe('createPluginRegistry', () => {
  it('registers a plugin', () => {
    const registry = createPluginRegistry();
    const api = makeMockApi();
    const plugin: Plugin = { name: 'test-plugin' };

    registry.register(plugin, api);

    expect(registry.getPlugins()).toHaveLength(1);
    expect(registry.getPlugins()[0].name).toBe('test-plugin');
  });

  it('calls setup on register and stores cleanup', () => {
    const registry = createPluginRegistry();
    const api = makeMockApi();
    const cleanup = vi.fn();
    const plugin: Plugin = {
      name: 'with-setup',
      setup: vi.fn(() => cleanup),
    };

    registry.register(plugin, api);

    expect(plugin.setup).toHaveBeenCalledWith(api);
  });

  it('unregisters a plugin', () => {
    const registry = createPluginRegistry();
    const api = makeMockApi();
    const plugin: Plugin = { name: 'removable' };

    registry.register(plugin, api);
    expect(registry.getPlugins()).toHaveLength(1);

    registry.unregister('removable');
    expect(registry.getPlugins()).toHaveLength(0);
  });

  it('calls cleanup on unregister', () => {
    const registry = createPluginRegistry();
    const api = makeMockApi();
    const cleanup = vi.fn();
    const plugin: Plugin = {
      name: 'cleanup-test',
      setup: () => cleanup,
    };

    registry.register(plugin, api);
    registry.unregister('cleanup-test');

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('catches and warns on cleanup errors', () => {
    const registry = createPluginRegistry();
    const api = makeMockApi();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    registry.register({
      name: 'bad-cleanup',
      setup: () => () => { throw new Error('boom'); },
    }, api);

    // Should not throw
    expect(() => registry.unregister('bad-cleanup')).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Plugin "bad-cleanup" cleanup threw:'),
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });

  it('re-registers a plugin by unregistering the old one first', () => {
    const registry = createPluginRegistry();
    const api = makeMockApi();
    const cleanup = vi.fn();
    const plugin1: Plugin = {
      name: 'dup',
      setup: () => cleanup,
    };
    const plugin2: Plugin = { name: 'dup' };

    registry.register(plugin1, api);
    registry.register(plugin2, api);

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(registry.getPlugins()).toHaveLength(1);
  });

  it('unregister is a no-op for unknown plugins', () => {
    const registry = createPluginRegistry();
    // Should not throw
    registry.unregister('nonexistent');
    expect(registry.getPlugins()).toHaveLength(0);
  });

  describe('callHook', () => {
    it('calls registered plugin hooks', () => {
      const registry = createPluginRegistry();
      const api = makeMockApi();
      const onActivate = vi.fn();
      const plugin: Plugin = {
        name: 'hook-test',
        hooks: { onActivate },
      };

      registry.register(plugin, api);
      registry.callHook('onActivate');

      expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it('calls hooks on all registered plugins', () => {
      const registry = createPluginRegistry();
      const api = makeMockApi();
      const onActivate1 = vi.fn();
      const onActivate2 = vi.fn();

      registry.register({ name: 'p1', hooks: { onActivate: onActivate1 } }, api);
      registry.register({ name: 'p2', hooks: { onActivate: onActivate2 } }, api);
      registry.callHook('onActivate');

      expect(onActivate1).toHaveBeenCalledTimes(1);
      expect(onActivate2).toHaveBeenCalledTimes(1);
    });

    it('passes arguments to hooks', () => {
      const registry = createPluginRegistry();
      const api = makeMockApi();
      const onElementSelect = vi.fn();
      const ctx = makeContext();

      registry.register({ name: 'args-test', hooks: { onElementSelect } }, api);
      registry.callHook('onElementSelect', ctx);

      expect(onElementSelect).toHaveBeenCalledWith(ctx);
    });

    it('handles plugins with no hooks gracefully', () => {
      const registry = createPluginRegistry();
      const api = makeMockApi();

      registry.register({ name: 'no-hooks' }, api);

      // Should not throw
      expect(() => registry.callHook('onActivate')).not.toThrow();
    });

    it('handles plugins without the specific hook', () => {
      const registry = createPluginRegistry();
      const api = makeMockApi();

      registry.register(
        { name: 'partial', hooks: { onDeactivate: vi.fn() } },
        api,
      );

      // Should not throw when calling a hook the plugin doesn't have
      expect(() => registry.callHook('onActivate')).not.toThrow();
    });

    it('catches and warns on hook errors without stopping other plugins', () => {
      const registry = createPluginRegistry();
      const api = makeMockApi();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onActivate2 = vi.fn();

      registry.register({
        name: 'bad',
        hooks: { onActivate: () => { throw new Error('boom'); } },
      }, api);
      registry.register({ name: 'good', hooks: { onActivate: onActivate2 } }, api);

      registry.callHook('onActivate');

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(onActivate2).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });
  });

  describe('callTransformHook', () => {
    it('chains transforms across plugins', () => {
      const registry = createPluginRegistry();
      const api = makeMockApi();
      const ctx = makeContext();

      registry.register({
        name: 'upper',
        hooks: { transformCopyContent: (text: string) => text.toUpperCase() },
      }, api);
      registry.register({
        name: 'prefix',
        hooks: { transformCopyContent: (text: string) => `PREFIX:${text}` },
      }, api);

      const result = registry.callTransformHook('hello', ctx);
      expect(result).toBe('PREFIX:HELLO');
    });

    it('returns original text when no plugins have transform', () => {
      const registry = createPluginRegistry();
      const api = makeMockApi();
      const ctx = makeContext();

      registry.register({ name: 'no-transform' }, api);

      const result = registry.callTransformHook('original', ctx);
      expect(result).toBe('original');
    });

    it('catches transform errors and continues', () => {
      const registry = createPluginRegistry();
      const api = makeMockApi();
      const ctx = makeContext();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      registry.register({
        name: 'bad-transform',
        hooks: { transformCopyContent: () => { throw new Error('fail'); } },
      }, api);
      registry.register({
        name: 'good-transform',
        hooks: { transformCopyContent: (text: string) => text + '-suffix' },
      }, api);

      // The bad transform throws, so the input to the good transform is still the original
      const result = registry.callTransformHook('input', ctx);
      expect(result).toBe('input-suffix');
      expect(warnSpy).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });
  });

  describe('dispose', () => {
    it('calls all cleanups and clears plugins', () => {
      const registry = createPluginRegistry();
      const api = makeMockApi();
      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn();

      registry.register({ name: 'p1', setup: () => cleanup1 }, api);
      registry.register({ name: 'p2', setup: () => cleanup2 }, api);

      registry.dispose();

      expect(cleanup1).toHaveBeenCalledTimes(1);
      expect(cleanup2).toHaveBeenCalledTimes(1);
      expect(registry.getPlugins()).toHaveLength(0);
    });

    it('ignores errors during cleanup and warns', () => {
      const registry = createPluginRegistry();
      const api = makeMockApi();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      registry.register({
        name: 'err',
        setup: () => () => { throw new Error('cleanup fail'); },
      }, api);

      // Should not throw
      expect(() => registry.dispose()).not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Plugin "err" cleanup threw:'),
        expect.any(Error),
      );
      expect(registry.getPlugins()).toHaveLength(0);
      warnSpy.mockRestore();
    });
  });
});
