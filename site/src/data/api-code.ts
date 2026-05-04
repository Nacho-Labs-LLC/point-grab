export const codePointGrabOptions = `interface PointGrabOptions {
  activationKey: string;
  activationMode: 'hold' | 'toggle';
  keyHoldDuration: number;
  maxContextLines: number;
  enabled: boolean;
  enableInInputs: boolean;
  devOnly: boolean;
  showToolbar: boolean;
  themeMode: ThemeMode;
  mcpWebhook: boolean;
  classFilters: ClassFilter[];
  htmlCleaners: HtmlCleaner[];
}`;

export const codeElementContext = `interface ElementContext {
  element: Element;
  html: string;
  componentName: string | null;
  filePath: string | null;
  line: number | null;
  column: number | null;
  componentStack: ComponentStackEntry[];
  selector: string;
  cssClasses: string[];
  textContent: string | null;
  ariaLabel: string | null;
  role: string | null;
  elementDescription: string | null;
}`;

export const codeStackEntry = `interface ComponentStackEntry {
  name: string;
  filePath: string | null;
  line: number | null;
  column: number | null;
}`;

export const codeHistoryEntry = `interface HistoryEntry {
  id: string;
  context: HistoryContext;
  snippet: string;
  timestamp: number;
}

interface HistoryContext {
  html: string;
  componentName: string | null;
  filePath: string | null;
  line: number | null;
  column: number | null;
  componentStack: ComponentStackEntry[];
  selector: string;
  cssClasses: string[];
  textContent: string | null;
  ariaLabel: string | null;
  role: string | null;
  elementDescription: string | null;
}`;

export const codePlugin = `interface Plugin {
  name: string;
  hooks?: PluginHooks;
  theme?: Partial<Theme>;
  options?: Partial<PointGrabOptions>;
  setup?: (api: PointGrabAPI) => PluginCleanup | void;
}

type PluginCleanup = () => void;`;

export const codeTheme = `interface Theme {
  overlayBorderColor: string;
  overlayBgColor: string;
  labelBgColor: string;
  labelTextColor: string;
  toastBgColor: string;
  toastTextColor: string;
  toolbarBgColor: string;
  toolbarTextColor: string;
  toolbarAccentColor: string;
  popoverBgColor: string;
  popoverTextColor: string;
  popoverBorderColor: string;
}`;

export const codeResolvers = `type ComponentResolver = (element: Element) => {
  name: string | null;
  hostElement: Element | null;
  stack?: Array<{ name: string; hostElement: Element | null }>;
} | null;

type SourceResolver = (element: Element) => {
  filePath: string | null;
  line: number | null;
  column: number | null;
} | null;`;

export const codeFilterTypes = `// Returns true to keep the class, false to strip it
type ClassFilter = (className: string) => boolean;

// Regex/replacer pair applied to raw outerHTML
type HtmlCleaner = { pattern: RegExp; replacement: string };`;

export const codePluginHooks = `interface PluginHooks {
  onActivate?(): void;
  onDeactivate?(): void;
  onElementHover?(element: Element): void;
  onElementSelect?(context: ElementContext): void;
  onBeforeCopy?(context: ElementContext): void;
  onCopySuccess?(text: string, context: ElementContext, prompt?: string): void;
  onCopyError?(error: Error): void;
  transformCopyContent?(text: string, context: ElementContext): string;
}`;

export const codeExecOrder = `activate()
  -> plugin1.onActivate() -> plugin2.onActivate()

[hover]
  -> plugin1.onElementHover(el) -> plugin2.onElementHover(el)

[click]
  -> buildElementContext()
  -> plugin1.onElementSelect(ctx) -> plugin2.onElementSelect(ctx)
  -> plugin1.onBeforeCopy(ctx)    -> plugin2.onBeforeCopy(ctx)
  -> generateSnippet()
  -> plugin1.transformCopyContent(text, ctx) -> plugin2.transformCopyContent(text, ctx)
  -> navigator.clipboard.writeText(finalText)
     success: plugin1.onCopySuccess(text, ctx) -> plugin2.onCopySuccess(text, ctx)
     failure: plugin1.onCopyError(error)       -> plugin2.onCopyError(error)

deactivate()
  -> plugin1.onDeactivate() -> plugin2.onDeactivate()

dispose()
  -> cleanup functions from setup()`;

export const codeLoggerPlugin = `import type { Plugin, PointGrabAPI } from 'point-grab';

function createLoggerPlugin(endpoint: string): Plugin {
  return {
    name: 'logger',
    options: { maxContextLines: 40 },
    theme: { overlayBorderColor: '#22c55e' },
    setup(api: PointGrabAPI) {
      const interval = setInterval(() => {
        console.log('History size:', api.getHistory().length);
      }, 60_000);
      return () => clearInterval(interval);
    },
    hooks: {
      onCopySuccess(text, context) {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ component: context.componentName }),
        }).catch(() => {});
      },
    },
  };
}`;

export const codeComponentResolver = `const myResolver: ComponentResolver = (element: Element) => {
  const stack: Array<{ name: string; hostElement: Element | null }> = [];
  let current: Element | null = element;
  while (current) {
    const meta = (current as any).__myFramework__;
    if (meta?.componentName) {
      stack.push({ name: meta.componentName, hostElement: current });
    }
    current = current.parentElement;
  }
  return {
    name: stack[0]?.name ?? null,
    hostElement: stack[0]?.hostElement ?? null,
    stack,
  };
};`;

export const codeSourceResolver = `const mySourceResolver: SourceResolver = (element: Element) => {
  let current: Element | null = element;
  while (current) {
    const meta = (current as any).__myFramework__;
    if (meta?.source) {
      return {
        filePath: meta.source.file,
        line: meta.source.line ?? null,
        column: meta.source.column ?? null,
      };
    }
    current = current.parentElement;
  }
  return { filePath: null, line: null, column: null };
};`;

export const codeRegistration = `import { init } from 'point-grab';
import type { ClassFilter, HtmlCleaner } from 'point-grab';

const myClassFilter: ClassFilter = (className) =>
  !className.startsWith('fw-');

const myHtmlCleaners: HtmlCleaner[] = [
  { pattern: /\\sdata-fw-[a-z]+(?:="[^"]*")?/gi, replacement: '' },
];

const inspector = init();
inspector.setComponentResolver(myResolver);
inspector.setSourceResolver(mySourceResolver);
inspector.setOptions({
  classFilters: [myClassFilter],
  htmlCleaners: myHtmlCleaners,
});`;

export const codeInit = `import { init } from 'point-grab';
const inspector = init({ activationMode: 'toggle' });`;

export const codeActivate = `inspector.activate();
console.log(inspector.isActive()); // true
inspector.toggle(); // now inactive`;

export const codeSetOptions = `inspector.setOptions({
  maxContextLines: 50,
  themeMode: 'light',
});`;

export const codeRegisterPlugin = `inspector.registerPlugin({
  name: 'my-plugin',
  hooks: { onCopySuccess(text, ctx) { console.log(ctx.componentName); } },
});

inspector.unregisterPlugin('my-plugin');`;
