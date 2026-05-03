import { init, createNoopApi } from 'pointgrab';
import type { PointGrabAPI, PointGrabOptions, Plugin } from 'pointgrab';
import { resolveComponent } from './resolvers/component-resolver';
import { resolveSource } from './resolvers/source-resolver';
import { vueClassFilter, vueHtmlCleaners } from './filters';

let instance: PointGrabAPI | null = null;

/**
 * Initialize pointgrab with Vue-specific resolvers and filters.
 * Idempotent -- subsequent calls return the same instance.
 */
export function initPointGrabVue(options?: Partial<PointGrabOptions>): PointGrabAPI {
  if (instance) return instance;

  // No-op in production when devOnly is requested
  if (options?.devOnly !== false && typeof process !== 'undefined' &&
      (process as Record<string, unknown>).env &&
      (process.env as Record<string, string>).NODE_ENV === 'production') {
    instance = createNoopApi();
    return instance;
  }

  instance = init(options);
  instance.setComponentResolver((el) => resolveComponent(el));
  instance.setSourceResolver((el) => resolveSource(el));
  instance.setOptions({
    classFilters: [vueClassFilter],
    htmlCleaners: vueHtmlCleaners,
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

/** Tear down the pointgrab instance. */
export function disposePointGrab(): void {
  instance?.dispose();
  instance = null;
}
