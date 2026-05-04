import type { PointGrabOptions } from 'point-grab';
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
 *   import { point-grab } from '@point-grab/svelte';
 * </script>
 *
 * <div use:point-grab>
 *   ...
 * </div>
 * ```
 */
export function point-grab(
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
