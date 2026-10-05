// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { resolveSource } from '../source-resolver';

describe('resolveSource', () => {
  it('reads source metadata from the selected element', () => {
    const element = document.createElement('button');
    element.dataset.pointGrabSource = 'src/components/Card.tsx:24:8';

    expect(resolveSource(element)).toEqual({
      filePath: 'src/components/Card.tsx',
      line: 24,
      column: 8,
    });
  });

  it('uses the nearest annotated ancestor when the selected element is unannotated', () => {
    const parent = document.createElement('section');
    parent.dataset.pointGrabSource = 'src/App.tsx:7:3';
    const child = document.createElement('span');
    parent.append(child);

    expect(resolveSource(child)).toEqual({
      filePath: 'src/App.tsx',
      line: 7,
      column: 3,
    });
  });

  it('returns null fields when source metadata is unavailable', () => {
    expect(resolveSource(document.createElement('div'))).toEqual({
      filePath: null,
      line: null,
      column: null,
    });
  });
});
