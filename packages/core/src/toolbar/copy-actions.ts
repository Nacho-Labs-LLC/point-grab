import type { ElementContext, HtmlCleaner, Annotation } from '../types';
import type { PluginRegistry } from '../plugins/plugin-registry';
import { generateSnippet } from '../clipboard/generate-snippet';
import { showToast } from '../overlay/toast';
import { cleanFrameworkAttrs } from '../utils';

export async function copyElementSnippet(
  context: ElementContext,
  maxLines: number,
  pluginRegistry?: PluginRegistry,
  htmlCleaners: HtmlCleaner[] = [],
): Promise<boolean> {
  let snippet = generateSnippet(context, maxLines, htmlCleaners);
  if (pluginRegistry) {
    snippet = pluginRegistry.callTransformHook(snippet, context);
  }
  const ok = await writeAndToast(snippet, 'Copied to clipboard', context);
  if (ok) pluginRegistry?.callHook('onCopySuccess', snippet, context, undefined);
  return ok;
}

export async function copyElementHtml(
  context: ElementContext,
  pluginRegistry?: PluginRegistry,
  htmlCleaners: HtmlCleaner[] = [],
): Promise<boolean> {
  const cleaned = cleanFrameworkAttrs(context.html, htmlCleaners);
  const ok = await writeAndToast(cleaned, 'HTML copied to clipboard', context);
  if (ok) pluginRegistry?.callHook('onCopySuccess', cleaned, context, undefined);
  return ok;
}

export async function copyElementStyles(element: Element): Promise<boolean> {
  if (!element.isConnected) {
    showToast('Element is no longer on the page');
    return false;
  }

  const computed = window.getComputedStyle(element);
  const tag = element.tagName.toLowerCase();
  const lines: string[] = [`/* Computed styles for <${tag}> */`, `${tag} {`];

  const props = [
    'display', 'position', 'top', 'right', 'bottom', 'left',
    'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
    'margin', 'padding',
    'border', 'border-radius',
    'background', 'background-color',
    'color', 'font', 'font-size', 'font-weight', 'font-family', 'line-height',
    'text-align', 'text-decoration', 'text-transform',
    'opacity', 'overflow', 'z-index',
    'flex-direction', 'justify-content', 'align-items', 'gap',
    'grid-template-columns', 'grid-template-rows',
    'box-shadow', 'cursor', 'transition', 'transform',
  ];

  for (const prop of props) {
    const value = computed.getPropertyValue(prop);
    if (value && value !== 'none' && value !== 'normal' && value !== 'auto' && value !== '0px' && value !== 'visible') {
      lines.push(`  ${prop}: ${value};`);
    }
  }

  lines.push('}');
  const css = lines.join('\n');

  return writeAndToast(css, 'Styles copied to clipboard');
}

export async function copyWithComment(
  context: ElementContext,
  comment: string,
  maxLines: number,
  pluginRegistry?: PluginRegistry,
  htmlCleaners: HtmlCleaner[] = [],
): Promise<boolean> {
  let snippet = generateSnippet(context, maxLines, htmlCleaners);
  if (pluginRegistry) {
    snippet = pluginRegistry.callTransformHook(snippet, context);
  }
  const full = `${snippet}\n\n/* Comment: ${comment} */`;
  const ok = await writeAndToast(full, 'Copied with comment', context);
  if (ok) pluginRegistry?.callHook('onCopySuccess', full, context, comment);
  return ok;
}

export async function copyAnnotationsAsPrompt(
  annotations: Annotation[],
  maxLines: number,
  pluginRegistry?: PluginRegistry,
  htmlCleaners: HtmlCleaner[] = [],
): Promise<boolean> {
  if (annotations.length === 0) return false;

  const sections: string[] = [];
  for (let i = 0; i < annotations.length; i++) {
    const { context, comment } = annotations[i];
    let snippet = generateSnippet(context, maxLines, htmlCleaners);
    if (pluginRegistry) {
      snippet = pluginRegistry.callTransformHook(snippet, context);
    }
    sections.push(`## Element ${i + 1}\n${snippet}\n\nComment: ${comment}`);
  }

  const full = sections.join('\n\n---\n\n');
  const label = annotations.length === 1 ? '1 annotation' : `${annotations.length} annotations`;
  const ok = await writeAndToast(full, `Copied ${label} as prompt`);
  if (ok && pluginRegistry) {
    for (const { context, comment } of annotations) {
      let snippet = generateSnippet(context, maxLines, htmlCleaners);
      snippet = pluginRegistry.callTransformHook(snippet, context);
      pluginRegistry.callHook('onCopySuccess', snippet, context, comment);
    }
  }
  return ok;
}

async function writeAndToast(text: string, message: string, context?: ElementContext): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    showToast(message, context ? {
      componentName: context.componentName,
      filePath: context.filePath,
      line: context.line,
      column: context.column,
      cssClasses: context.cssClasses,
    } : undefined);
    return true;
  } catch {
    return false;
  }
}
