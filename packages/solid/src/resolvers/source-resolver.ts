interface SourceResult {
  filePath: string | null;
  line: number | null;
  column: number | null;
}

const SOURCE_ATTRIBUTE = 'data-point-grab-source';
const SOURCE_PATTERN = /^(.*):(\d+):(\d+)$/;

function parseSource(source: string): SourceResult {
  const match = source.match(SOURCE_PATTERN);
  if (!match) return { filePath: null, line: null, column: null };

  return {
    filePath: match[1],
    line: Number(match[2]),
    column: Number(match[3]),
  };
}

export function resolveSource(element: Element): SourceResult {
  let current: Element | null = element;
  while (current) {
    const source = current.getAttribute(SOURCE_ATTRIBUTE);
    if (source) return parseSource(source);
    current = current.parentElement;
  }

  return { filePath: null, line: null, column: null };
}
