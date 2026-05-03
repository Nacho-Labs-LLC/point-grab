interface FiberNode {
  tag: number;
  type: unknown;
  return: FiberNode | null;
  _debugSource?: {
    fileName?: string;
    lineNumber?: number;
    columnNumber?: number;
  } | null;
  _debugOwner?: FiberNode | null;
}

interface SourceResult {
  filePath: string | null;
  line: number | null;
  column: number | null;
}

function getFiber(element: Element): FiberNode | null {
  const keys = Object.keys(element);
  const fiberKey = keys.find(
    (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'),
  );
  if (!fiberKey) return null;
  return (element as unknown as Record<string, unknown>)[fiberKey] as FiberNode ?? null;
}

function isComponentFiber(fiber: FiberNode): boolean {
  return fiber.tag === 0 || fiber.tag === 1;
}

export function resolveSource(element: Element): SourceResult {
  const fiber = getFiber(element);
  if (!fiber) return { filePath: null, line: null, column: null };

  // Check _debugSource on the fiber itself first
  if (fiber._debugSource) {
    return {
      filePath: fiber._debugSource.fileName ?? null,
      line: fiber._debugSource.lineNumber ?? null,
      column: fiber._debugSource.columnNumber ?? null,
    };
  }

  // Walk up to find the nearest component with source info
  let current: FiberNode | null = fiber.return;
  while (current) {
    if (isComponentFiber(current) && current._debugSource) {
      return {
        filePath: current._debugSource.fileName ?? null,
        line: current._debugSource.lineNumber ?? null,
        column: current._debugSource.columnNumber ?? null,
      };
    }
    current = current.return;
  }

  // Try _debugOwner chain as a fallback
  let owner = fiber._debugOwner ?? null;
  while (owner) {
    if (owner._debugSource) {
      return {
        filePath: owner._debugSource.fileName ?? null,
        line: owner._debugSource.lineNumber ?? null,
        column: owner._debugSource.columnNumber ?? null,
      };
    }
    owner = owner._debugOwner ?? null;
  }

  return { filePath: null, line: null, column: null };
}
