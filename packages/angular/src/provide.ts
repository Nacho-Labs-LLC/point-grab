import {
  InjectionToken,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
  type EnvironmentProviders,
} from '@angular/core';
import type { PointGrabAPI, PointGrabOptions } from '@point-grab/core';
import { initPointGrabAngular } from './init';

export const POINT_GRAB_API = new InjectionToken<PointGrabAPI>('POINT_GRAB_API');

/**
 * Angular DI provider that initializes point-grab at environment bootstrap.
 *
 * @example
 * ```ts
 * bootstrapApplication(AppComponent, {
 *   providers: [providePointGrab()],
 * });
 * ```
 */
export function providePointGrab(
  options?: Partial<PointGrabOptions>,
): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: POINT_GRAB_API,
      useFactory: () => initPointGrabAngular(options),
    },
    provideEnvironmentInitializer(() => initPointGrabAngular(options)),
  ]);
}
