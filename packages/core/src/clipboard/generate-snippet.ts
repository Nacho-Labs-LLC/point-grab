import type { ElementContext, HtmlCleaner } from '../types';
import { cleanFrameworkAttrs } from '../utils';

function truncateHtml(html: string, maxLines: number): string {
  const lines = html.split('\n');
  if (lines.length <= maxLines) return html;

  return lines.slice(0, maxLines).join('\n') + '\n  ...';
}

function formatLocation(name: string | null, filePath: string | null, line: number | null, column: number | null): string {
  let locationLine = '';
  if (name) locationLine += `in ${name}`;
  if (filePath) {
    const loc = filePath +
      (line != null ? `:${line}` : '') +
      (line != null && column != null ? `:${column}` : '');
    locationLine += locationLine ? ` at ${loc}` : `at ${loc}`;
  }
  return locationLine;
}

export function generateSnippet(context: ElementContext, maxContextLines: number, htmlCleaners: HtmlCleaner[] = []): string {
  const cleaned = cleanFrameworkAttrs(context.html, htmlCleaners);
  const truncated = truncateHtml(cleaned, maxContextLines);

  const parts: string[] = [truncated];

  // Semantic description
  if (context.elementDescription) {
    parts.push(context.elementDescription);
  }

  // Component location
  if (context.componentStack.length > 0) {
    for (const entry of context.componentStack) {
      parts.push(formatLocation(entry.name, entry.filePath, entry.line, entry.column));
    }
  } else if (context.componentName || context.filePath) {
    parts.push(formatLocation(context.componentName, context.filePath, context.line, context.column));
  }

  return parts.join('\n');
}
