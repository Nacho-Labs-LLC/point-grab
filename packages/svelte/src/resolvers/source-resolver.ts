interface SvelteMeta {
  loc?: {
    file?: string;
    line?: number;
    column?: number;
    char?: number;
  };
  type?: string;
  name?: string;
}

interface SourceResult {
  filePath: string | null;
  line: number | null;
  column: number | null;
}

function getSvelte5Meta(element: Element): SvelteMeta | null {
  return (element as unknown as Record<string, unknown>).__svelte_meta as SvelteMeta | undefined ?? null;
}

export function resolveSource(element: Element): SourceResult {
  // Svelte 5: __svelte_meta.loc has file/line info
  let current: Element | null = element;
  while (current) {
    const meta = getSvelte5Meta(current);
    if (meta?.loc) {
      return {
        filePath: meta.loc.file ?? null,
        line: meta.loc.line ?? null,
        column: meta.loc.column ?? null,
      };
    }
    current = current.parentElement;
  }

  return { filePath: null, line: null, column: null };
}
