import type { ElementContext, HtmlCleaner } from '../types';

function describeElement(element: Element): string {
  const tag = element.tagName.toLowerCase();
  if (element.id) return `<${tag}#${element.id}>`;

  const className = typeof element.className === 'string' ? element.className.trim().split(/\s+/).filter(Boolean)[0] : '';
  return `<${tag}${className ? `.${className}` : ''}>`;
}

function formatLocation(name: string | null, filePath: string | null, line: number | null, column: number | null): string {
  const location = filePath
    ? `${filePath}${line != null ? `:${line}` : ''}${line != null && column != null ? `:${column}` : ''}`
    : '';
  if (name && location) return `${name} at ${location}`;
  return name || (location ? `at ${location}` : '');
}

export function generateSnippet(context: ElementContext, _maxContextLines: number, _htmlCleaners: HtmlCleaner[] = []): string {
  const element = describeElement(context.element);
  const parent = context.element.parentElement ? ` in ${describeElement(context.element.parentElement)}` : '';
  const source = context.componentStack[0]
    ? formatLocation(context.componentStack[0].name, context.componentStack[0].filePath, context.componentStack[0].line, context.componentStack[0].column)
    : formatLocation(context.componentName, context.filePath, context.line, context.column);

  return `[${element}${parent}${source ? ` (${source})` : ''}]`;
}
