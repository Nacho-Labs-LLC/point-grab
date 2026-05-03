import {
  InjectionToken,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
  type EnvironmentProviders,
} from '@angular/core';
import type { PointGrabAPI, PointGrabOptions } from 'pointgrab';
import { initPointGrabAngular } from './init';

export const POINTGRAB_API = new InjectionToken<PointGrabAPI>('POINTGRAB_API');

/**
 * Angular DI provider that initializes pointgrab at environment bootstrap.
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
      provide: POINTGRAB_API,
      useFactory: () => initPointGrabAngular(options),
    },
    provideEnvironmentInitializer(() => initPointGrabAngular(options)),
  ]);
}
