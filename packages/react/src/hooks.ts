import { useEffect, useRef } from 'react';
import type { PointGrabAPI, PointGrabOptions } from 'pointgrab';
import { initPointGrabReact, disposePointGrab } from './init';

/**
 * React hook that initializes pointgrab on mount and disposes on unmount.
 *
 * @example
 * ```tsx
 * function App() {
 *   usePointGrab({ activationMode: 'toggle' });
 *   return <div>...</div>;
 * }
 * ```
 */
export function usePointGrab(options?: Partial<PointGrabOptions>): PointGrabAPI | null {
  const apiRef = useRef<PointGrabAPI | null>(null);

  useEffect(() => {
    apiRef.current = initPointGrabReact(options);

    return () => {
      disposePointGrab();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- options should be stable
  }, []);

  return apiRef.current;
}
