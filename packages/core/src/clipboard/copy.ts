import type { ElementContext, ComponentStackEntry, ComponentResolver, SourceResolver, ClassFilter, HtmlCleaner } from '../types';
import type { PluginRegistry } from '../plugins/plugin-registry';
import { generateSnippet } from './generate-snippet';
import { showToast, type ToastDetail } from '../overlay/toast';
import { filterFrameworkClasses, extractElementDescription } from '../utils';

export interface CopyDeps {
  getComponentResolver: () => ComponentResolver | null;
  getSourceResolver: () => SourceResolver | null;
  getMaxContextLines: () => number;
  getClassFilters?: () => ClassFilter[];
  getHtmlCleaners?: () => HtmlCleaner[];
  pluginRegistry: PluginRegistry;
}

function buildSelector(el: Element, classFilters: ClassFilter[] = []): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const classes = filterFrameworkClasses(el.classList, classFilters)
    .map((c) => `.${c}`)
    .join('');
  return `${tag}${id}${classes}`;
}

function getCssClasses(el: Element, classFilters: ClassFilter[] = []): string[] {
  return filterFrameworkClasses(el.classList, classFilters);
}

export function buildElementContext(
  element: Element,
  componentResolver: ComponentResolver | null,
  sourceResolver: SourceResolver | null,
  classFilters: ClassFilter[] = [],
  htmlCleaners: HtmlCleaner[] = [],
): ElementContext {
  const compResult = componentResolver?.(element);
  const srcResult = sourceResolver?.(element);

  // Build component stack from resolver result
  const componentStack: ComponentStackEntry[] = [];
  if (compResult?.stack) {
    for (const entry of compResult.stack) {
      let filePath: string | null = null;
      let line: number | null = null;
      let column: number | null = null;

      if (entry.hostElement && sourceResolver) {
        const src = sourceResolver(entry.hostElement);
        if (src) {
          filePath = src.filePath;
          line = src.line;
          column = src.column;
        }
      }

      componentStack.push({ name: entry.name, filePath, line, column });
    }
  }

  const textContent = element.textContent?.trim().replace(/\s+/g, ' ') || null;
  const ariaLabel = element.getAttribute('aria-label') || null;
  const role = element.getAttribute('role') || null;
  const elementDescription = extractElementDescription(element);

  return {
    element,
    html: element.outerHTML,
    componentName: compResult?.name ?? null,
    filePath: srcResult?.filePath ?? null,
    line: srcResult?.line ?? null,
    column: srcResult?.column ?? null,
    componentStack,
    selector: buildSelector(element, classFilters),
    cssClasses: getCssClasses(element, classFilters),
    textContent: textContent ? (textContent.length > 200 ? textContent.slice(0, 200) + '…' : textContent) : null,
    ariaLabel,
    role,
    elementDescription,
  };
}

export interface CopyResult {
  context: ElementContext;
  snippet: string;
}

export async function copyElement(element: Element, deps: CopyDeps): Promise<CopyResult | null> {
  const classFilters = deps.getClassFilters?.() ?? [];
  const htmlCleaners = deps.getHtmlCleaners?.() ?? [];
  const context = buildElementContext(
    element,
    deps.getComponentResolver(),
    deps.getSourceResolver(),
    classFilters,
    htmlCleaners,
  );

  deps.pluginRegistry.callHook('onElementSelect', context);
  deps.pluginRegistry.callHook('onBeforeCopy', context);

  let snippet = generateSnippet(context, deps.getMaxContextLines(), htmlCleaners);
  snippet = deps.pluginRegistry.callTransformHook(snippet, context);

  try {
    await navigator.clipboard.writeText(snippet);
    const detail: ToastDetail = {
      componentName: context.componentName,
      filePath: context.filePath,
      line: context.line,
      column: context.column,
      cssClasses: context.cssClasses,
    };
    showToast('Copied to clipboard', detail);
    deps.pluginRegistry.callHook('onCopySuccess', snippet, context, undefined);
    return { context, snippet };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    deps.pluginRegistry.callHook('onCopyError', error);
    return null;
  }
}
