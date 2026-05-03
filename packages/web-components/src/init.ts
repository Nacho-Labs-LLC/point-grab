import { init, createNoopApi } from 'pointgrab';
import type { PointGrabAPI, PointGrabOptions, Plugin } from 'pointgrab';
import { resolveComponent } from './resolvers/component-resolver';
import { resolveSource } from './resolvers/source-resolver';
import { wcClassFilter, wcHtmlCleaners } from './filters';

let instance: PointGrabAPI | null = null;

/**
 * Initialize pointgrab with Web Components / Shadow DOM resolvers.
 * Idempotent -- subsequent calls return the same instance.
 */
export function initPointGrabWebComponents(options?: Partial<PointGrabOptions>): PointGrabAPI {
  if (instance) return instance;

  // No-op in production when devOnly is requested
  const devFlag = (globalThis as unknown as Record<string, unknown>).__POINTGRAB_DEV__;
  if (options?.devOnly !== false && typeof devFlag !== 'undefined' && !devFlag) {
    instance = createNoopApi();
    return instance;
  }

  instance = init(options);
  instance.setComponentResolver((el) => resolveComponent(el));
  instance.setSourceResolver((el) => resolveSource(el));
  instance.setOptions({
    classFilters: [wcClassFilter],
    htmlCleaners: wcHtmlCleaners,
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
