// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { generateSnippet } from '../clipboard/generate-snippet';
import type { ElementContext } from '../types';

function makeContext(overrides: Partial<ElementContext> = {}): ElementContext {
  const parent = document.createElement('div');
  parent.className = 'dashboard';
  const element = document.createElement('h1');
  element.className = 'title';
  parent.appendChild(element);
  return {
    element,
    html: '<h1 class="title">Revenue</h1>',
    componentName: null,
    filePath: null,
    line: null,
    column: null,
    componentStack: [],
    selector: 'h1.title',
    cssClasses: ['title'],
    textContent: 'Revenue',
    ariaLabel: null,
    role: 'heading',
    elementDescription: null,
    ...overrides,
  };
}

describe('generateSnippet', () => {
  it('formats a compact element, parent, component, and source reference', () => {
    const result = generateSnippet(makeContext({
      componentName: 'RevenueCard', filePath: 'components/revenue-card.tsx', line: 74, column: 32,
    }), 20);

    expect(result).toBe('[<h1.title> in <div.dashboard> (RevenueCard at components/revenue-card.tsx:74:32)]');
  });

  it('uses compact DOM identity without source context', () => {
    const result = generateSnippet(makeContext(), 20);
    expect(result).toBe('[<h1.title> in <div.dashboard>]');
  });

  it('keeps component-only context without introducing raw markup', () => {
    const result = generateSnippet(makeContext({ componentName: 'RevenueCard' }), 20);
    expect(result).toBe('[<h1.title> in <div.dashboard> (RevenueCard)]');
    expect(result).not.toContain('Revenue</h1>');
  });

  it('uses the closest component stack entry as the source context', () => {
    const result = generateSnippet(makeContext({
      componentName: 'Outer',
      componentStack: [{ name: 'Inner', filePath: 'src/inner.ts', line: 3, column: 1 }],
    }), 20);
    expect(result).toBe('[<h1.title> in <div.dashboard> (Inner at src/inner.ts:3:1)]');
  });

  it('degrades gracefully for parentless elements and partial locations', () => {
    const element = document.createElement('button');
    element.id = 'save';
    const result = generateSnippet(makeContext({
      element, html: '<button id="save">Save</button>', componentName: null, filePath: 'src/app.ts', line: 5, column: null,
    }), 20);
    expect(result).toBe('[<button#save> (at src/app.ts:5)]');
  });
});
