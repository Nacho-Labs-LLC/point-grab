import { useEffect, useState } from 'react';
import type { PointGrabAPI, PointGrabOptions } from '@point-grab/core';
import { initPointGrabReact, disposePointGrab } from './init';

/**
 * React hook that initializes point-grab on mount and disposes on unmount.
 * Returns `null` during the first render, then the API instance once mounted.
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
  // State (not a ref) so the component re-renders with the instance once mounted.
  const [api, setApi] = useState<PointGrabAPI | null>(null);

  useEffect(() => {
    setApi(initPointGrabReact(options));

    return () => {
      disposePointGrab();
      setApi(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- options should be stable
  }, []);

  return api;
}
