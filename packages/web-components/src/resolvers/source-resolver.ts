interface SourceMapEntry {
  file: string;
  line: number;
  column?: number;
}

interface SourceResult {
  filePath: string | null;
  line: number | null;
  column: number | null;
}

function getWcSourceMap(): Record<string, SourceMapEntry> | null {
  return (globalThis as Record<string, unknown>).__POINTGRAB_WC_SOURCE_MAP__ as
    Record<string, SourceMapEntry> | undefined ?? null;
}

export function resolveSource(element: Element): SourceResult {
  // Check for __source on the constructor (build-time injected)
  const ctorSource = (element.constructor as Record<string, unknown>).__source as
    { file?: string; line?: number; column?: number } | undefined;
  if (ctorSource?.file) {
    return {
      filePath: ctorSource.file,
      line: ctorSource.line ?? null,
      column: ctorSource.column ?? null,
    };
  }

  // Fall back to global source map
  const sourceMap = getWcSourceMap();
  if (!sourceMap) return { filePath: null, line: null, column: null };

  // Look up by tag name
  const tagName = element.tagName.toLowerCase();
  let entry = sourceMap[tagName];

  // Try class name as well
  if (!entry) {
    const className = element.constructor?.name;
    if (className) {
      entry = sourceMap[className];
    }
  }

  if (!entry) return { filePath: null, line: null, column: null };

  return {
    filePath: entry.file,
    line: entry.line,
    column: entry.column ?? null,
  };
}
