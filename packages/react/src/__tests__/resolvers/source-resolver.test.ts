import { describe, it, expect } from 'vitest';
import { resolveSource } from '../../resolvers/source-resolver';

// Types to match the ones in source-resolver
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

function createMockElement(fiber?: FiberNode, fiberKey: string = '__reactFiber$123'): Element {
  const el = {} as Record<string, unknown>;
  if (fiber) {
    el[fiberKey] = fiber;
  }
  return el as unknown as Element;
}

function createFiber(
  overrides: Partial<FiberNode> = {}
): FiberNode {
  return {
    tag: 0,
    type: 'div',
    return: null,
    ...overrides,
  };
}

describe('resolveSource', () => {
  it('returns empty result when no fiber is found', () => {
    const element = {} as Element;
    const result = resolveSource(element);
    expect(result).toEqual({ filePath: null, line: null, column: null });
  });

  it('supports __reactInternalInstance$ key format', () => {
    const fiber = createFiber({
      _debugSource: {
        fileName: 'src/legacy.tsx',
        lineNumber: 100,
        columnNumber: 5,
      },
    });
    const element = createMockElement(fiber, '__reactInternalInstance$123');

    const result = resolveSource(element);
    expect(result).toEqual({
      filePath: 'src/legacy.tsx',
      line: 100,
      column: 5,
    });
  });

  it('returns source from the fiber itself', () => {
    const fiber = createFiber({
      _debugSource: {
        fileName: 'src/components/Button.tsx',
        lineNumber: 10,
        columnNumber: 5,
      },
    });
    const element = createMockElement(fiber);

    const result = resolveSource(element);
    expect(result).toEqual({
      filePath: 'src/components/Button.tsx',
      line: 10,
      column: 5,
    });
  });

  it('handles partial source info on the fiber', () => {
    const fiber = createFiber({
      _debugSource: {
        fileName: 'src/components/Button.tsx',
      },
    });
    const element = createMockElement(fiber);

    const result = resolveSource(element);
    expect(result).toEqual({
      filePath: 'src/components/Button.tsx',
      line: null,
      column: null,
    });
  });

  it('finds source from nearest component up the return tree', () => {
    const componentFiber = createFiber({
      tag: 0, // FUNCTION_COMPONENT
      _debugSource: {
        fileName: 'src/components/Container.tsx',
        lineNumber: 20,
        columnNumber: 15,
      },
    });

    const hostFiber = createFiber({
      tag: 5, // HOST_COMPONENT (e.g., div)
      return: componentFiber,
    });

    const element = createMockElement(hostFiber);

    const result = resolveSource(element);
    expect(result).toEqual({
      filePath: 'src/components/Container.tsx',
      line: 20,
      column: 15,
    });
  });

  it('skips non-component fibers in the return tree', () => {
    const componentFiber = createFiber({
      tag: 0, // FUNCTION_COMPONENT
      _debugSource: {
        fileName: 'src/components/Container.tsx',
        lineNumber: 20,
        columnNumber: 15,
      },
    });

    const contextFiber = createFiber({
      tag: 10, // Context provider or something else
      _debugSource: { fileName: 'ignored.tsx', lineNumber: 1, columnNumber: 1 },
      return: componentFiber
    });

    const hostFiber = createFiber({
      tag: 5, // HOST_COMPONENT (e.g., div)
      return: contextFiber,
    });

    const element = createMockElement(hostFiber);

    const result = resolveSource(element);
    expect(result).toEqual({
      filePath: 'src/components/Container.tsx',
      line: 20,
      column: 15,
    });
  });

  it('finds source from nearest component up the _debugOwner tree', () => {
    const ownerFiber = createFiber({
      tag: 0,
      _debugSource: {
        fileName: 'src/components/App.tsx',
        lineNumber: 5,
        columnNumber: 2,
      },
    });

    const hostFiber = createFiber({
      tag: 5,
      // No component in return tree
      return: createFiber({ tag: 5 }),
      _debugOwner: ownerFiber,
    });

    const element = createMockElement(hostFiber);

    const result = resolveSource(element);
    expect(result).toEqual({
      filePath: 'src/components/App.tsx',
      line: 5,
      column: 2,
    });
  });

  it('falls back from return tree to _debugOwner tree if no source is found in return tree', () => {
    const ownerFiber = createFiber({
      tag: 0,
      _debugSource: {
        fileName: 'src/components/App.tsx',
        lineNumber: 5,
        columnNumber: 2,
      },
    });

    const componentFiberWithoutSource = createFiber({
      tag: 0,
      _debugSource: null,
    });

    const hostFiber = createFiber({
      tag: 5,
      return: componentFiberWithoutSource, // Component without source
      _debugOwner: ownerFiber, // Owner with source
    });

    const element = createMockElement(hostFiber);

    const result = resolveSource(element);
    expect(result).toEqual({
      filePath: 'src/components/App.tsx',
      line: 5,
      column: 2,
    });
  });
});
