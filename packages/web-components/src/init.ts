import { init, createNoopApi } from '@point-grab/core';
import type { PointGrabAPI, PointGrabOptions, Plugin } from '@point-grab/core';
import { resolveComponent } from './resolvers/component-resolver';
import { resolveSource } from './resolvers/source-resolver';
import { wcClassFilter, wcHtmlCleaners } from './filters';
import { deepElementFromPoint } from './shadow-dom';

let instance: PointGrabAPI | null = null;

/**
 * Initialize point-grab with Web Components / Shadow DOM resolvers.
 * Idempotent -- subsequent calls return the same instance.
 */
export function initPointGrabWebComponents(options?: Partial<PointGrabOptions>): PointGrabAPI {
  if (instance) return instance;

  // No-op in production when devOnly is requested
  const devFlag = (globalThis as unknown as Record<string, unknown>).__POINT_GRAB_DEV__;
  if (options?.devOnly !== false && typeof devFlag !== 'undefined' && !devFlag) {
    instance = createNoopApi();
    return instance;
  }

  instance = init(options);
  instance.setComponentResolver((el) => resolveComponent(el));
  instance.setSourceResolver((el) => resolveSource(el));
  instance.setElementFromPoint(deepElementFromPoint);
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

/** Tear down the point-grab instance. */
export function disposePointGrab(): void {
  instance?.dispose();
  instance = null;
}
