import type { Plugin, PluginHooks, PluginCleanup, ElementContext, PointGrabAPI } from '../types';

export interface PluginRegistry {
  register(plugin: Plugin, api: PointGrabAPI): void;
  unregister(name: string): void;
  callHook<K extends keyof PluginHooks>(hookName: K, ...args: Parameters<NonNullable<PluginHooks[K]>>): void;
  callTransformHook(text: string, context: ElementContext): string;
  getPlugins(): ReadonlyArray<Plugin>;
  dispose(): void;
}

export function createPluginRegistry(): PluginRegistry {
  const plugins = new Map<string, Plugin>();
  const cleanups = new Map<string, PluginCleanup>();

  return {
    register(plugin: Plugin, api: PointGrabAPI): void {
      if (plugins.has(plugin.name)) {
        this.unregister(plugin.name);
      }
      plugins.set(plugin.name, plugin);

      if (plugin.setup) {
        const cleanup = plugin.setup(api);
        if (cleanup) {
          cleanups.set(plugin.name, cleanup);
        }
      }
    },

    unregister(name: string): void {
      const cleanup = cleanups.get(name);
      if (cleanup) {
        try {
          cleanup();
        } catch (err) {
          console.warn(`[point-grab] Plugin "${name}" cleanup threw:`, err);
        }
        cleanups.delete(name);
      }
      plugins.delete(name);
    },

    callHook<K extends keyof PluginHooks>(hookName: K, ...args: Parameters<NonNullable<PluginHooks[K]>>): void {
      for (const plugin of plugins.values()) {
        const hook = plugin.hooks?.[hookName];
        if (hook) {
          try {
            (hook as (...a: any[]) => void)(...args);
          } catch (err) {
            console.warn(`[point-grab] Plugin "${plugin.name}" hook "${hookName}" threw:`, err);
          }
        }
      }
    },

    callTransformHook(text: string, context: ElementContext): string {
      let result = text;
      for (const plugin of plugins.values()) {
        const transform = plugin.hooks?.transformCopyContent;
        if (transform) {
          try {
            result = transform(result, context);
          } catch (err) {
            console.warn(`[point-grab] Plugin "${plugin.name}" transformCopyContent threw:`, err);
          }
        }
      }
      return result;
    },

    getPlugins(): ReadonlyArray<Plugin> {
      return Array.from(plugins.values());
    },

    dispose(): void {
      for (const [name, cleanup] of cleanups.entries()) {
        try {
          cleanup();
        } catch (err) {
          console.warn(`[point-grab] Plugin "${name}" cleanup threw:`, err);
        }
      }
      cleanups.clear();
      plugins.clear();
    },
  };
}
