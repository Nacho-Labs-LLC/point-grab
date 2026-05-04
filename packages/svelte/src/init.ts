import { init, createNoopApi } from 'point-grab';
import type { PointGrabAPI, PointGrabOptions, Plugin } from 'point-grab';
import { resolveComponent } from './resolvers/component-resolver';
import { resolveSource } from './resolvers/source-resolver';
import { svelteClassFilter, svelteHtmlCleaners } from './filters';

let instance: PointGrabAPI | null = null;

/**
 * Initialize point-grab with Svelte-specific resolvers and filters.
 * Idempotent -- subsequent calls return the same instance.
 */
export function initPointGrabSvelte(options?: Partial<PointGrabOptions>): PointGrabAPI {
  if (instance) return instance;

  // No-op in production when devOnly is requested
  if (options?.devOnly !== false && typeof process !== 'undefined' &&
      (process as unknown as Record<string, unknown>).env &&
      (process.env as Record<string, string>).NODE_ENV === 'production') {
    instance = createNoopApi();
    return instance;
  }

  instance = init(options);
  instance.setComponentResolver((el) => resolveComponent(el));
  instance.setSourceResolver((el) => resolveSource(el));
  instance.setOptions({
    classFilters: [svelteClassFilter],
    htmlCleaners: svelteHtmlCleaners,
  });

  return instance;
}

/** Returns the current API instance, or null if not yet initialized. */
export function getPointGrabApi(): PointGrabAPI | null {
  return instance;
}

/** Register a plugin on the current instance. */
export function registerPointGrabPlugin(plugin: Plugin): void {
  instance?.registerPlugin(plugin);
}

/** Tear down the point-grab instance. */
export function disposePointGrab(): void {
  instance?.dispose();
  instance = null;
}
