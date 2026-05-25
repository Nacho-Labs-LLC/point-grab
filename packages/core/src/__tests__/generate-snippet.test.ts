// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { generateSnippet } from '../clipboard/generate-snippet';
import type { ElementContext, ComponentStackEntry } from '../types';

function makeContext(overrides: Partial<ElementContext> = {}): ElementContext {
  return {
    element: document.createElement('div'),
    html: '<div>hello</div>',
    componentName: null,
    filePath: null,
    line: null,
    column: null,
    componentStack: [],
    selector: 'div',
    cssClasses: [],
    textContent: null,
    ariaLabel: null,
    role: null,
    elementDescription: null,
    ...overrides,
  };
}

describe('generateSnippet', () => {
  it('generates HTML-only snippet when no component info', () => {
    const ctx = makeContext({ html: '<button>Click</button>', selector: '' });
    const result = generateSnippet(ctx, 20);
    expect(result).toBe('<button>Click</button>');
  });

  it('includes selector line', () => {
    const ctx = makeContext({ selector: 'div.card#main' });
    const result = generateSnippet(ctx, 20);
    expect(result).toContain('selector: div.card#main');
  });

  it('includes element description when present', () => {
    const ctx = makeContext({ elementDescription: "Button: 'Submit'" });
    const result = generateSnippet(ctx, 20);
    expect(result).toContain("Button: 'Submit'");
  });

  it('includes component name and file path', () => {
    const ctx = makeContext({
      html: '<div>test</div>',
      componentName: 'AppComponent',
      filePath: 'src/app/app.component.ts',
      line: 10,
      column: 5,
    });
    const result = generateSnippet(ctx, 20);

    expect(result).toContain('<div>test</div>');
    expect(result).toContain('in AppComponent');
    expect(result).toContain('at src/app/app.component.ts:10:5');
  });

  it('includes component name without file path', () => {
    const ctx = makeContext({ componentName: 'MyComponent', selector: '' });
    const result = generateSnippet(ctx, 20);

    expect(result).toContain('in MyComponent');
    expect(result).not.toContain('at');
  });

  it('includes file path without component name', () => {
    const ctx = makeContext({
      filePath: 'src/app.ts',
      line: 5,
      selector: '',
    });
    const result = generateSnippet(ctx, 20);

    expect(result).toContain('at src/app.ts:5');
    expect(result).not.toContain('in ');
  });

  it('includes component stack trace', () => {
    const stack: ComponentStackEntry[] = [
      { name: 'ChildComponent', filePath: 'src/child.ts', line: 3, column: 1 },
      { name: 'ParentComponent', filePath: 'src/parent.ts', line: 10, column: null },
      { name: 'AppComponent', filePath: 'src/app.ts', line: null, column: null },
    ];
    const ctx = makeContext({
      html: '<span>hi</span>',
      componentStack: stack,
    });
    const result = generateSnippet(ctx, 20);

    expect(result).toContain('in ChildComponent at src/child.ts:3:1');
    expect(result).toContain('in ParentComponent at src/parent.ts:10');
    expect(result).toContain('in AppComponent at src/app.ts');
  });

  it('prefers component stack over componentName/filePath', () => {
    const stack: ComponentStackEntry[] = [
      { name: 'Inner', filePath: 'inner.ts', line: 1, column: null },
    ];
    const ctx = makeContext({
      componentName: 'Outer',
      filePath: 'outer.ts',
      line: 99,
      column: null,
      componentStack: stack,
    });
    const result = generateSnippet(ctx, 20);

    expect(result).toContain('in Inner at inner.ts:1');
    expect(result).not.toContain('Outer');
  });

  it('respects maxLines truncation', () => {
    const multilineHtml = Array.from({ length: 10 }, (_, i) => `  <line${i}/>`).join('\n');
    const ctx = makeContext({ html: multilineHtml, selector: '' });
    const result = generateSnippet(ctx, 3);

    const lines = result.split('\n');
    // 3 HTML lines + "  ..." truncation line
    expect(lines.length).toBe(4);
    expect(lines[3]).toBe('  ...');
  });

  it('does not truncate when HTML is within maxLines', () => {
    const html = '<div>\n  <span>hi</span>\n</div>';
    const ctx = makeContext({ html, selector: '' });
    const result = generateSnippet(ctx, 10);

    expect(result).not.toContain('...');
    expect(result).toBe(html);
  });

  it('cleans framework attributes from HTML when cleaners provided', () => {
    const html = '<div _nghost-abc-123="">content</div>';
    const cleaners = [
      { pattern: /\s_ng(host|content)-[a-z0-9-]+="[^"]*"/gi, replacement: '' },
      { pattern: /\s_ng(host|content)-[a-z0-9-]+/gi, replacement: '' },
    ];
    const ctx = makeContext({ html, selector: '' });
    const result = generateSnippet(ctx, 20, cleaners);

    expect(result).toBe('<div>content</div>');
    expect(result).not.toContain('_nghost');
  });

  it('passes through HTML unchanged when no cleaners provided', () => {
    const html = '<div _nghost-abc-123="">content</div>';
    const ctx = makeContext({ html, selector: '' });
    const result = generateSnippet(ctx, 20);

    expect(result).toBe(html);
  });

  it('handles null fields gracefully', () => {
    const ctx = makeContext({
      componentName: null,
      filePath: null,
      line: null,
      column: null,
      componentStack: [],
      selector: '',
    });
    const result = generateSnippet(ctx, 20);

    // Should just be the HTML, no location info
    expect(result).toBe('<div>hello</div>');
  });

  it('handles stack entry with null filePath', () => {
    const stack: ComponentStackEntry[] = [
      { name: 'Comp', filePath: null, line: null, column: null },
    ];
    const ctx = makeContext({ componentStack: stack });
    const result = generateSnippet(ctx, 20);

    expect(result).toContain('in Comp');
    expect(result).not.toContain('at');
  });

  it('ignores column when line is null', () => {
    const ctx = makeContext({
      filePath: 'src/app.ts',
      line: null,
      column: 15,
      selector: '',
    });
    const result = generateSnippet(ctx, 20);

    expect(result).toContain('at src/app.ts');
    expect(result).not.toContain(':15');
  });

  it('handles empty component stack entries gracefully', () => {
    const stack: ComponentStackEntry[] = [
      { name: null, filePath: null, line: null, column: null },
    ];
    const ctx = makeContext({
      html: '<div>hello</div>',
      selector: '',
      componentStack: stack
    });
    const result = generateSnippet(ctx, 20);

    // Only HTML should be output, as the stack entry yields empty location string
    expect(result).toBe('<div>hello</div>\n');
  });
});
