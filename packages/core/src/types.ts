export type ThemeMode = 'dark' | 'light' | 'system';

export type PendingAction =
  | { type: 'copy-element' }
  | { type: 'copy-styles' }
  | { type: 'copy-html' }
  | { type: 'comment' };

export interface Annotation {
  context: ElementContext;
  comment: string;
}

export type CaptureSessionAction = 'accepted' | 'skipped' | 'updated' | 'ended';

export interface CaptureSessionEventDetail {
  action: CaptureSessionAction;
  annotationCount: number;
  annotations: readonly Annotation[];
  target?: ElementContext;
}

/** Serializable subset of ElementContext — no live DOM reference. */
export interface HistoryContext {
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
}

export interface HistoryEntry {
  id: string;
  context: HistoryContext;
  snippet: string;
  timestamp: number;
}

export interface ToolbarState {
  visible: boolean;
  themeMode: ThemeMode;
  history: HistoryEntry[];
  pendingAction: PendingAction | null;
}

/** A filter function that returns true if the class should be kept. */
export type ClassFilter = (className: string) => boolean;

/** A regex/replacer pair for cleaning framework-specific attributes from HTML. */
export type HtmlCleaner = { pattern: RegExp; replacement: string };

export interface PointGrabOptions {
  /** Keyboard shortcut to toggle capture mode. Default: "Meta+Shift+C" (Mac) / "Ctrl+Shift+C" (Win) */
  activationKey: string;
  /** Whether activation toggles on/off. Default: 'toggle' */
  activationMode: 'hold' | 'toggle';
  /** Milliseconds to hold before activating in hold mode. Default: 0 */
  keyHoldDuration: number;
  /** Max lines of HTML to include in copied context. Default: 20 */
  maxContextLines: number;
  /** Maximum accepted captures in one session. Default: 3 */
  maxCaptureCount: number;
  /** Master on/off switch. Default: true */
  enabled: boolean;
  /** Allow activation while focused in input/textarea. Default: false */
  enableInInputs: boolean;
  /** Only activate in dev mode. Default: true */
  devOnly: boolean;
  /** Show the floating mini toolbar. Default: true */
  showToolbar: boolean;
  /** Theme mode for all UI. Default: 'dark' */
  themeMode: ThemeMode;
  /** Auto-register MCP webhook plugin to POST grabs to localhost:3456. Default: true */
  mcpWebhook: boolean;
  /** Array of filter functions for CSS class filtering. Framework adapters inject their own. */
  classFilters: ClassFilter[];
  /** Array of regex/replacer pairs for cleaning framework attrs from HTML. */
  htmlCleaners: HtmlCleaner[];
}

export interface ComponentStackEntry {
  name: string;
  filePath: string | null;
  line: number | null;
  column: number | null;
}

export interface ElementContext {
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
}

export interface PluginHooks {
  onActivate?: () => void;
  onDeactivate?: () => void;
  onElementHover?: (element: Element) => void;
  onElementSelect?: (context: ElementContext) => void;
  onBeforeCopy?: (context: ElementContext) => void;
  onCopySuccess?: (text: string, context: ElementContext, prompt?: string) => void;
  onCopyError?: (error: Error) => void;
  transformCopyContent?: (text: string, context: ElementContext) => string;
}

export interface Theme {
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
}

export interface Plugin {
  name: string;
  hooks?: PluginHooks;
  theme?: Partial<Theme>;
  options?: Partial<PointGrabOptions>;
  setup?: (api: PointGrabAPI) => PluginCleanup | void;
}

export type PluginCleanup = () => void;

export type ComponentResolver = (element: Element) => {
  name: string | null;
  hostElement: Element | null;
  stack?: Array<{ name: string; hostElement: Element | null }>;
} | null;

export type SourceResolver = (element: Element) => {
  filePath: string | null;
  line: number | null;
  column: number | null;
} | null;

export interface PointGrabAPI {
  activate(): void;
  deactivate(): void;
  toggle(): void;
  isActive(): boolean;
  setOptions(opts: Partial<PointGrabOptions>): void;
  registerPlugin(plugin: Plugin): void;
  unregisterPlugin(name: string): void;
  setComponentResolver(resolver: ComponentResolver): void;
  setSourceResolver(resolver: SourceResolver): void;
  setElementFromPoint(fn: (x: number, y: number) => Element | null): void;
  showToolbar(): void;
  hideToolbar(): void;
  setThemeMode(mode: ThemeMode): void;
  getHistory(): HistoryEntry[];
  clearHistory(): void;
  dispose(): void;
}
