import type { ClassFilter, HtmlCleaner, ElementContext } from './types';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Filters a classList using configurable filter functions.
 * Each filter returns true if the class should be kept.
 * With no filters (default), all classes pass through.
 * Framework adapters inject their own filters (e.g. Angular: exclude ng-* / _ng* classes).
 */
export function filterFrameworkClasses(classList: DOMTokenList, filters: ClassFilter[] = []): string[] {
  const classes = Array.from(classList);
  if (filters.length === 0) return classes;
  return classes.filter((c) => filters.every((fn) => fn(c)));
}

/**
 * Cleans framework-specific attributes from HTML using configurable regex/replacer pairs.
 * With no cleaners (default), HTML passes through unchanged.
 * Framework adapters inject their own cleaners (e.g. Angular: remove _nghost-* / _ngcontent-* attrs).
 */
export function cleanFrameworkAttrs(html: string, cleaners: HtmlCleaner[] = []): string {
  return cleaners.reduce((result, { pattern, replacement }) => result.replace(pattern, replacement), html);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '…';
}

function getDirectText(el: Element): string | null {
  let text = '';
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? '';
  }
  text = text.trim().replace(/\s+/g, ' ');
  return text || null;
}

export function extractElementDescription(el: Element): string | null {
  const tag = el.tagName.toLowerCase();
  const ariaLabel = el.getAttribute('aria-label');

  if (tag === 'button' || el.getAttribute('role') === 'button') {
    const label = ariaLabel || getDirectText(el) || el.getAttribute('title');
    return label ? `Button: '${truncate(label, 50)}'` : 'Button';
  }

  if (tag === 'a') {
    const href = el.getAttribute('href');
    const label = ariaLabel || getDirectText(el);
    if (label && href) return `Link '${truncate(label, 40)}' → ${truncate(href, 60)}`;
    if (href) return `Link → ${truncate(href, 60)}`;
    if (label) return `Link '${truncate(label, 50)}'`;
    return 'Link';
  }

  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    const type = el.getAttribute('type') || (tag === 'input' ? 'text' : tag);
    const label = ariaLabel
      || el.getAttribute('placeholder')
      || findAssociatedLabel(el);
    return label ? `${capitalize(type)} input: '${truncate(label, 50)}'` : `${capitalize(type)} input`;
  }

  if (tag === 'img') {
    const alt = el.getAttribute('alt');
    return alt ? `Image: '${truncate(alt, 50)}'` : 'Image';
  }

  if (/^h[1-6]$/.test(tag)) {
    const text = getDirectText(el) || el.textContent?.trim().replace(/\s+/g, ' ');
    return text ? `Heading (${tag}): '${truncate(text, 50)}'` : `Heading (${tag})`;
  }

  if (ariaLabel) return truncate(ariaLabel, 60);

  return null;
}

function findAssociatedLabel(el: Element): string | null {
  const id = el.getAttribute('id');
  if (id) {
    const label = el.ownerDocument?.querySelector(`label[for="${id}"]`);
    if (label) return label.textContent?.trim() ?? null;
  }
  const parentLabel = el.closest('label');
  if (parentLabel) return parentLabel.textContent?.trim() ?? null;
  return null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
