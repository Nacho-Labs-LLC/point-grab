import { createNoopApi, init } from '@point-grab/core';
import type { Plugin, PointGrabAPI, PointGrabOptions } from '@point-grab/core';
import { solidClassFilter, solidHtmlCleaners } from './filters';
import { resolveComponent } from './resolvers/component-resolver';
import { resolveSource } from './resolvers/source-resolver';

let instance: PointGrabAPI | null = null;

/** Initialize point-grab with Solid-specific resolvers and HTML cleanup. */
export function initPointGrabSolid(options?: Partial<PointGrabOptions>): PointGrabAPI {
  if (instance) return instance;

  if (options?.devOnly !== false && typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
    instance = createNoopApi();
    return instance;
  }

  instance = init(options);
  instance.setComponentResolver(resolveComponent);
  instance.setSourceResolver(resolveSource);
  instance.setOptions({
    classFilters: [solidClassFilter, ...(options?.classFilters ?? [])],
    htmlCleaners: [...solidHtmlCleaners, ...(options?.htmlCleaners ?? [])],
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
