import { init, createNoopApi } from 'point-grab';
import type { PointGrabAPI, PointGrabOptions, Plugin } from 'point-grab';
import { resolveComponent } from './resolvers/component-resolver';
import { resolveSource } from './resolvers/source-resolver';
import { angularClassFilter, angularHtmlCleaners } from './filters';

declare const ngDevMode: boolean | undefined;

let instance: PointGrabAPI | null = null;

/**
 * Initialize point-grab with Angular-specific resolvers and filters.
 * Idempotent -- subsequent calls return the same instance.
 */
export function initPointGrabAngular(options?: Partial<PointGrabOptions>): PointGrabAPI {
  if (instance) return instance;

  // No-op in Angular production builds
  if (options?.devOnly !== false && typeof ngDevMode !== 'undefined' && !ngDevMode) {
    instance = createNoopApi();
    return instance;
  }

  instance = init(options);
  instance.setComponentResolver((el) => resolveComponent(el));
  instance.setSourceResolver((el) => resolveSource(el));
  instance.setOptions({
    classFilters: [angularClassFilter],
    htmlCleaners: angularHtmlCleaners,
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
