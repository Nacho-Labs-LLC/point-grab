interface FiberNode {
  tag: number;
  type: unknown;
  return: FiberNode | null;
  _debugSource?: {
    fileName?: string;
    lineNumber?: number;
    columnNumber?: number;
  } | null;
  _debugStack?: {
    stack?: string;
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

function getDebugStackSource(fiber: FiberNode): SourceResult | null {
  const stack = fiber._debugStack?.stack;
  if (!stack) return null;

  for (const line of stack.split('\n')) {
    const match = line.match(/\((.+):(\d+):(\d+)\)$/) ?? line.match(/at (.+):(\d+):(\d+)$/);
    if (!match || match[1].includes('node_modules')) continue;

    return {
      filePath: match[1],
      line: Number(match[2]),
      column: Number(match[3]),
    };
  }

  return null;
}

function getDebugSource(fiber: FiberNode): SourceResult | null {
  if (fiber._debugSource) {
    return {
      filePath: fiber._debugSource.fileName ?? null,
      line: fiber._debugSource.lineNumber ?? null,
      column: fiber._debugSource.columnNumber ?? null,
    };
  }

  return getDebugStackSource(fiber);
}

export function resolveSource(element: Element): SourceResult {
  const fiber = getFiber(element);
  if (!fiber) return { filePath: null, line: null, column: null };

  // React 18 exposes _debugSource; React 19 replaced it with _debugStack.
  const ownSource = getDebugSource(fiber);
  if (ownSource) return ownSource;

  // Walk up to find the nearest component with source info
  let current: FiberNode | null = fiber.return;
  while (current) {
    if (isComponentFiber(current)) {
      const source = getDebugSource(current);
      if (source) return source;
    }
    current = current.return;
  }

  // Try _debugOwner chain as a fallback
  let owner = fiber._debugOwner ?? null;
  while (owner) {
    const source = getDebugSource(owner);
    if (source) return source;
    owner = owner._debugOwner ?? null;
  }

  return { filePath: null, line: null, column: null };
}
