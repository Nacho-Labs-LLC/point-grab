import type { PointGrabOptions } from '@point-grab/core';
import { initPointGrabSvelte, disposePointGrab } from './init';

interface ActionReturn {
  destroy: () => void;
}

/**
 * Svelte action for component-level opt-in to point-grab.
 *
 * @example
 * ```svelte
 * <script>
 *   import { pointGrab } from '@point-grab/svelte';
 * </script>
 *
 * <div use:pointGrab>
 *   ...
 * </div>
 * ```
 */
export function pointGrab(
  _node: HTMLElement,
  options?: Partial<PointGrabOptions>,
): ActionReturn {
  initPointGrabSvelte(options);

  return {
    destroy() {
      disposePointGrab();
    },
  };
}
