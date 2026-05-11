// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { buildElementContext } from '../clipboard/copy';
import type { ComponentResolver, SourceResolver, ClassFilter } from '../types';

describe('buildElementContext', () => {
  it('builds basic element context without resolvers', () => {
    const el = document.createElement('div');
    el.id = 'test-id';
    el.className = 'class1 class2';
    el.textContent = '  Some   text  ';

    const context = buildElementContext(el, null, null);

    expect(context.element).toBe(el);
    expect(context.selector).toBe('div#test-id.class1.class2');
    expect(context.cssClasses).toEqual(['class1', 'class2']);
    expect(context.html).toBe('<div id="test-id" class="class1 class2">  Some   text  </div>');
    expect(context.textContent).toBe('Some text');
    expect(context.componentName).toBeNull();
    expect(context.filePath).toBeNull();
    expect(context.componentStack).toEqual([]);
  });

  it('integrates with component and source resolvers', () => {
    const el = document.createElement('button');
    const componentResolver: ComponentResolver = vi.fn().mockReturnValue({
      name: 'MyButton',
      stack: []
    });
    const sourceResolver: SourceResolver = vi.fn().mockReturnValue({
      filePath: 'src/components/Button.tsx',
      line: 10,
      column: 5
    });

    const context = buildElementContext(el, componentResolver, sourceResolver);

    expect(componentResolver).toHaveBeenCalledWith(el);
    expect(sourceResolver).toHaveBeenCalledWith(el);
    expect(context.componentName).toBe('MyButton');
    expect(context.filePath).toBe('src/components/Button.tsx');
    expect(context.line).toBe(10);
    expect(context.column).toBe(5);
  });

  it('builds component stack with source info', () => {
    const el = document.createElement('div');
    const host1 = document.createElement('section');
    const host2 = document.createElement('article');

    const componentResolver: ComponentResolver = vi.fn().mockReturnValue({
      name: 'Leaf',
      stack: [
        { name: 'Child', hostElement: host1 },
        { name: 'Parent', hostElement: host2 },
        { name: 'Root', hostElement: null }
      ]
    });

    const sourceResolver: SourceResolver = vi.fn((element) => {
      if (element === el) return { filePath: 'el.ts', line: 1, column: 1 };
      if (element === host1) return { filePath: 'host1.ts', line: 10, column: 2 };
      if (element === host2) return { filePath: 'host2.ts', line: 20, column: 3 };
      return null;
    });

    const context = buildElementContext(el, componentResolver, sourceResolver);

    expect(context.componentStack).toEqual([
      { name: 'Child', filePath: 'host1.ts', line: 10, column: 2 },
      { name: 'Parent', filePath: 'host2.ts', line: 20, column: 3 },
      { name: 'Root', filePath: null, line: null, column: null }
    ]);
  });

  it('applies class filters', () => {
    const el = document.createElement('div');
    el.className = 'keep-me remove-me ng-binding';

    const classFilters: ClassFilter[] = [
      (c) => c !== 'remove-me',
      (c) => !c.startsWith('ng-')
    ];

    const context = buildElementContext(el, null, null, classFilters);

    expect(context.cssClasses).toEqual(['keep-me']);
    expect(context.selector).toBe('div.keep-me');
  });

  it('truncates long text content', () => {
    const el = document.createElement('div');
    el.textContent = 'a'.repeat(300);

    const context = buildElementContext(el, null, null);

    expect(context.textContent?.length).toBe(201); // 200 + '…'
    expect(context.textContent).endsWith('…');
  });

  it('extracts ARIA attributes and element description', () => {
    const el = document.createElement('button');
    el.setAttribute('aria-label', 'Submit Form');
    el.setAttribute('role', 'button');
    el.textContent = 'Click me';

    const context = buildElementContext(el, null, null);

    expect(context.ariaLabel).toBe('Submit Form');
    expect(context.role).toBe('button');
    expect(context.elementDescription).toBe("Button: 'Submit Form'");
  });

  it('handles null textContent', () => {
    const el = document.createElement('div');
    // element with no children has null or empty textContent depending on implementation,
    // but JSDOM usually returns ""

    const context = buildElementContext(el, null, null);
    expect(context.textContent).toBeNull();
  });
});
