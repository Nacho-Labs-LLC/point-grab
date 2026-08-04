// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { resolveSource } from '../source-resolver';

function attachFiber(element: Element, fiber: object): void {
  Object.assign(element, { '__reactFiber$test': fiber });
}

describe('resolveSource', () => {
  it('resolves an own React 19 named debug-stack frame', () => {
    const element = document.createElement('button');
    attachFiber(element, {
      tag: 5,
      type: 'button',
      return: null,
      _debugStack: {
        stack: 'at SaveButton (C:/repo/src/components/SaveButton.tsx:12:7)',
      },
    });

    expect(resolveSource(element)).toEqual({
      filePath: 'C:/repo/src/components/SaveButton.tsx',
      line: 12,
      column: 7,
    });
  });

  it('skips node_modules frames in a React 19 debug stack', () => {
    const element = document.createElement('button');
    attachFiber(element, {
      tag: 5,
      type: 'button',
      return: null,
      _debugStack: {
        stack: [
          'at useState (C:/repo/node_modules/react/cjs/react.development.js:1261:12)',
          'at CheckoutForm (C:/repo/src/features/checkout/CheckoutForm.tsx:42:9)',
        ].join('\n'),
      },
    });

    expect(resolveSource(element)).toEqual({
      filePath: 'C:/repo/src/features/checkout/CheckoutForm.tsx',
      line: 42,
      column: 9,
    });
  });

  it('resolves a React 19 debug stack from the nearest component ancestor', () => {
    const element = document.createElement('span');
    attachFiber(element, {
      tag: 5,
      type: 'span',
      _debugStack: null,
      return: {
        tag: 0,
        type: () => null,
        return: null,
        _debugStack: {
          stack: 'at ProductCard (C:/repo/src/components/ProductCard.tsx:28:5)',
        },
      },
    });

    expect(resolveSource(element)).toEqual({
      filePath: 'C:/repo/src/components/ProductCard.tsx',
      line: 28,
      column: 5,
    });
  });

  it('resolves a React 19 debug stack through the debug-owner fallback', () => {
    const element = document.createElement('input');
    attachFiber(element, {
      tag: 5,
      type: 'input',
      return: null,
      _debugOwner: {
        tag: 0,
        type: () => null,
        return: null,
        _debugStack: {
          stack: 'at SearchPanel (C:/repo/src/features/search/SearchPanel.tsx:61:11)',
        },
      },
    });

    expect(resolveSource(element)).toEqual({
      filePath: 'C:/repo/src/features/search/SearchPanel.tsx',
      line: 61,
      column: 11,
    });
  });
});
