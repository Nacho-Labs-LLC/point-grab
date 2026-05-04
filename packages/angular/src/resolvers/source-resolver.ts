import { getNgApi, cleanComponentName } from './ng-utils';
import type { NgDebugApi } from './ng-utils';

interface SourceMapEntry {
  file: string;
  line: number;
}

function getSourceMap(): Record<string, SourceMapEntry> | null {
  return (globalThis as unknown as Record<string, unknown>).__POINT_GRAB_SOURCE_MAP__ as
    Record<string, SourceMapEntry> | undefined ?? null;
}

interface SourceResult {
  filePath: string | null;
  line: number | null;
  column: number | null;
}

export function resolveSource(element: Element): SourceResult {
  const sourceMap = getSourceMap();
  if (!sourceMap) return { filePath: null, line: null, column: null };

  const ng = getNgApi();
  if (!ng) return { filePath: null, line: null, column: null };

  const componentName = findComponentName(element, ng);
  if (!componentName) return { filePath: null, line: null, column: null };

  const entry = sourceMap[componentName];
  if (!entry) return { filePath: null, line: null, column: null };

  return { filePath: entry.file, line: entry.line, column: null };
}

export function resolveSourceForComponent(componentName: string): SourceResult {
  const sourceMap = getSourceMap();
  if (!sourceMap) return { filePath: null, line: null, column: null };

  const entry = sourceMap[componentName];
  if (!entry) return { filePath: null, line: null, column: null };

  return { filePath: entry.file, line: entry.line, column: null };
}

function findComponentName(element: Element, ng: NgDebugApi): string | null {
  const direct = ng.getComponent(element);
  if (direct && typeof direct === 'object') {
    return cleanComponentName(direct.constructor.name);
  }

  let current: Element | null = element;
  while (current) {
    const owning = ng.getOwningComponent(current);
    if (owning && typeof owning === 'object') {
      return cleanComponentName(owning.constructor.name);
    }
    current = current.parentElement;
  }

  return null;
}
