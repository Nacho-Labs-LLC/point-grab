interface FiberNode {
  tag: number;
  type: {
    displayName?: string;
    name?: string;
  } | string | null;
  return: FiberNode | null;
  stateNode: Element | null;
  _debugOwner?: FiberNode | null;
}

// React fiber tag constants
const FUNCTION_COMPONENT = 0;
const CLASS_COMPONENT = 1;

interface ComponentResult {
  name: string | null;
  hostElement: Element | null;
  stack: Array<{ name: string; hostElement: Element | null }>;
}

function getFiber(element: Element): FiberNode | null {
  for (const key in element) {
    if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
      return (element as unknown as Record<string, unknown>)[key] as FiberNode ?? null;
    }
  }
  return null;
}

function getComponentName(fiber: FiberNode): string | null {
  const type = fiber.type;
  if (!type || typeof type === 'string') return null;
  return type.displayName || type.name || null;
}

function isComponentFiber(fiber: FiberNode): boolean {
  return fiber.tag === FUNCTION_COMPONENT || fiber.tag === CLASS_COMPONENT;
}

function findHostElement(fiber: FiberNode): Element | null {
  // Walk down to find the nearest host (DOM) element
  let current: FiberNode | null = fiber;
  while (current) {
    if (current.stateNode instanceof Element) return current.stateNode;
    current = current.return;
  }
  return null;
}

export function resolveComponent(element: Element): ComponentResult {
  const fiber = getFiber(element);
  if (!fiber) return { name: null, hostElement: null, stack: [] };

  const stack: Array<{ name: string; hostElement: Element | null }> = [];
  const seen = new Set<FiberNode>();

  // Walk up the fiber tree collecting component boundaries
  let current: FiberNode | null = fiber;
  while (current) {
    if (isComponentFiber(current) && !seen.has(current)) {
      seen.add(current);
      const name = getComponentName(current);
      if (name) {
        stack.push({
          name,
          hostElement: findHostElement(current),
        });
      }
    }
    current = current.return;
  }

  const closest = stack.length > 0 ? stack[0] : { name: null, hostElement: null };

  return {
    name: closest.name,
    hostElement: closest.hostElement,
    stack,
  };
}
