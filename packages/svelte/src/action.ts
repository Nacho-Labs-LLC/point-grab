import type { PointGrabOptions } from 'pointgrab';
import { initPointGrabSvelte, disposePointGrab } from './init';

interface ActionReturn {
  destroy: () => void;
}

/**
 * Svelte action for component-level opt-in to pointgrab.
 *
 * @example
 * ```svelte
 * <script>
 *   import { pointgrab } from '@pointgrab/svelte';
 * </script>
 *
 * <div use:pointgrab>
 *   ...
 * </div>
 * ```
 */
export function pointgrab(
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
