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

function isDecimalInteger(value: string): boolean {
  if (value.length === 0) return false;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 48 || code > 57) return false;
  }

  return true;
}

function getStackLocation(line: string): SourceResult | null {
  let location: string;

  if (line.endsWith(')')) {
    const openingParenthesis = line.lastIndexOf('(');
    if (openingParenthesis === -1) return null;
    location = line.slice(openingParenthesis + 1, -1);
  } else if (line.startsWith('at ')) {
    location = line.slice(3);
  } else {
    return null;
  }

  const columnSeparator = location.lastIndexOf(':');
  if (columnSeparator === -1) return null;
  const lineSeparator = location.lastIndexOf(':', columnSeparator - 1);
  if (lineSeparator === -1) return null;

  const filePath = location.slice(0, lineSeparator);
  const lineNumber = location.slice(lineSeparator + 1, columnSeparator);
  const columnNumber = location.slice(columnSeparator + 1);
  if (!filePath || !isDecimalInteger(lineNumber) || !isDecimalInteger(columnNumber)) return null;

  return {
    filePath,
    line: Number(lineNumber),
    column: Number(columnNumber),
  };
}

function getDebugStackSource(fiber: FiberNode): SourceResult | null {
  const stack = fiber._debugStack?.stack;
  if (!stack) return null;

  for (const line of stack.split('\n')) {
    const source = getStackLocation(line);
    if (!source?.filePath || source.filePath.includes('node_modules')) continue;

    return source;
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
