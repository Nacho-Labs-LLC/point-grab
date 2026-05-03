// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { escapeHtml, filterFrameworkClasses, cleanFrameworkAttrs, extractElementDescription } from '../utils';
import type { ClassFilter, HtmlCleaner } from '../types';

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
  });

  it('passes through double quotes (not special in text nodes)', () => {
    // innerHTML only escapes <, >, & in text content — not quotes
    expect(escapeHtml('"hello"')).toBe('"hello"');
  });

  it('passes through single quotes (not special in text nodes)', () => {
    expect(escapeHtml("it's")).toBe("it's");
  });

  it('escapes multiple special characters together', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe(
      '&lt;a href="x"&gt;&amp;&lt;/a&gt;',
    );
  });

  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('returns plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

describe('filterFrameworkClasses', () => {
  function makeDOMTokenList(...classes: string[]): DOMTokenList {
    const el = document.createElement('div');
    for (const c of classes) el.classList.add(c);
    return el.classList;
  }

  it('returns all classes when no filters provided', () => {
    const list = makeDOMTokenList('foo', 'ng-star-inserted', '_ngcontent-abc');
    expect(filterFrameworkClasses(list)).toEqual(['foo', 'ng-star-inserted', '_ngcontent-abc']);
  });

  it('returns all classes with empty filters array', () => {
    const list = makeDOMTokenList('foo', 'bar');
    expect(filterFrameworkClasses(list, [])).toEqual(['foo', 'bar']);
  });

  it('filters classes using provided filter functions', () => {
    const angularFilter: ClassFilter = (c) => !c.startsWith('ng-') && !c.startsWith('_ng');
    const list = makeDOMTokenList('foo', 'ng-star-inserted', '_ngcontent-abc', 'bar');
    expect(filterFrameworkClasses(list, [angularFilter])).toEqual(['foo', 'bar']);
  });

  it('applies multiple filters (all must pass)', () => {
    const noNg: ClassFilter = (c) => !c.startsWith('ng-');
    const noUnderscore: ClassFilter = (c) => !c.startsWith('_');
    const list = makeDOMTokenList('foo', 'ng-star', '_private', 'bar');
    expect(filterFrameworkClasses(list, [noNg, noUnderscore])).toEqual(['foo', 'bar']);
  });
});

describe('extractElementDescription', () => {
  it('describes a button by its text content', () => {
    const btn = document.createElement('button');
    btn.textContent = 'Submit Order';
    expect(extractElementDescription(btn)).toBe("Button: 'Submit Order'");
  });

  it('prefers aria-label over text for buttons', () => {
    const btn = document.createElement('button');
    btn.textContent = 'X';
    btn.setAttribute('aria-label', 'Close dialog');
    expect(extractElementDescription(btn)).toBe("Button: 'Close dialog'");
  });

  it('describes a role=button element', () => {
    const div = document.createElement('div');
    div.setAttribute('role', 'button');
    div.textContent = 'Click me';
    expect(extractElementDescription(div)).toBe("Button: 'Click me'");
  });

  it('describes a link with text and href', () => {
    const a = document.createElement('a');
    a.setAttribute('href', '/checkout');
    a.textContent = 'Go to checkout';
    expect(extractElementDescription(a)).toBe("Link 'Go to checkout' → /checkout");
  });

  it('describes a link with only href', () => {
    const a = document.createElement('a');
    a.setAttribute('href', '/about');
    expect(extractElementDescription(a)).toBe('Link → /about');
  });

  it('describes an input with placeholder', () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'email');
    input.setAttribute('placeholder', 'Enter your email');
    expect(extractElementDescription(input)).toBe("Email input: 'Enter your email'");
  });

  it('describes an input with associated label', () => {
    const label = document.createElement('label');
    label.setAttribute('for', 'name-field');
    label.textContent = 'Full Name';
    const input = document.createElement('input');
    input.setAttribute('id', 'name-field');
    document.body.appendChild(label);
    document.body.appendChild(input);
    expect(extractElementDescription(input)).toBe("Text input: 'Full Name'");
    document.body.removeChild(label);
    document.body.removeChild(input);
  });

  it('describes an image with alt text', () => {
    const img = document.createElement('img');
    img.setAttribute('alt', 'Company logo');
    expect(extractElementDescription(img)).toBe("Image: 'Company logo'");
  });

  it('describes an image without alt text', () => {
    const img = document.createElement('img');
    expect(extractElementDescription(img)).toBe('Image');
  });

  it('describes headings with text', () => {
    const h2 = document.createElement('h2');
    h2.textContent = 'Getting Started';
    expect(extractElementDescription(h2)).toBe("Heading (h2): 'Getting Started'");
  });

  it('falls back to aria-label for generic elements', () => {
    const div = document.createElement('div');
    div.setAttribute('aria-label', 'Main content area');
    expect(extractElementDescription(div)).toBe('Main content area');
  });

  it('returns null for generic elements without semantic info', () => {
    const div = document.createElement('div');
    div.textContent = 'some text';
    expect(extractElementDescription(div)).toBeNull();
  });

  it('truncates long text', () => {
    const btn = document.createElement('button');
    btn.textContent = 'A'.repeat(100);
    const desc = extractElementDescription(btn)!;
    expect(desc.length).toBeLessThan(70);
    expect(desc).toContain('…');
  });
});

describe('cleanFrameworkAttrs', () => {
  const angularCleaners: HtmlCleaner[] = [
    { pattern: /\s_ng(host|content)-[a-z0-9-]+="[^"]*"/gi, replacement: '' },
    { pattern: /\s_ng(host|content)-[a-z0-9-]+/gi, replacement: '' },
  ];

  it('returns HTML unchanged when no cleaners provided', () => {
    const html = '<div _nghost-abc-123="">text</div>';
    expect(cleanFrameworkAttrs(html)).toBe(html);
  });

  it('returns HTML unchanged with empty cleaners array', () => {
    const html = '<div _nghost-abc-123="">text</div>';
    expect(cleanFrameworkAttrs(html, [])).toBe(html);
  });

  it('removes _nghost attributes with values using Angular cleaners', () => {
    const html = '<div _nghost-abc-123=""></div>';
    expect(cleanFrameworkAttrs(html, angularCleaners)).toBe('<div></div>');
  });

  it('removes _ngcontent attributes with values using Angular cleaners', () => {
    const html = '<span _ngcontent-xyz-456=""></span>';
    expect(cleanFrameworkAttrs(html, angularCleaners)).toBe('<span></span>');
  });

  it('removes _nghost attributes without values using Angular cleaners', () => {
    const html = '<div _nghost-abc-123></div>';
    expect(cleanFrameworkAttrs(html, angularCleaners)).toBe('<div></div>');
  });

  it('removes _ngcontent attributes without values using Angular cleaners', () => {
    const html = '<span _ngcontent-xyz-456></span>';
    expect(cleanFrameworkAttrs(html, angularCleaners)).toBe('<span></span>');
  });

  it('removes multiple framework attributes from one tag', () => {
    const html = '<div _nghost-abc-123="" _ngcontent-xyz-456="">text</div>';
    expect(cleanFrameworkAttrs(html, angularCleaners)).toBe('<div>text</div>');
  });

  it('removes framework attributes from nested elements', () => {
    const html =
      '<div _nghost-a-1=""><span _ngcontent-b-2="">hi</span></div>';
    expect(cleanFrameworkAttrs(html, angularCleaners)).toBe('<div><span>hi</span></div>');
  });

  it('preserves non-framework attributes', () => {
    const html = '<div class="foo" id="bar" _nghost-abc-123="">text</div>';
    expect(cleanFrameworkAttrs(html, angularCleaners)).toBe(
      '<div class="foo" id="bar">text</div>',
    );
  });

  it('returns unchanged HTML when no framework attributes present', () => {
    const html = '<div class="test">hello</div>';
    expect(cleanFrameworkAttrs(html, angularCleaners)).toBe(html);
  });

  it('handles empty string', () => {
    expect(cleanFrameworkAttrs('', angularCleaners)).toBe('');
  });
});
