import type {
  PointGrabOptions,
  PointGrabAPI,
  Plugin,
  ComponentResolver,
  SourceResolver,
  ElementContext,
  Annotation,
  HistoryContext,
  HistoryEntry,
  ThemeMode,
  PendingAction,
} from './types';
import { createStore } from './store';
import { createOverlayRenderer } from './overlay/overlay-renderer';
import { createCrosshair } from './overlay/crosshair';
import { showToast, disposeToast } from './overlay/toast';
import { createElementPicker } from './picker/element-picker';
import { createKeyboardHandler, isMac } from './keyboard/keyboard-handler';
import { copyElement, buildElementContext } from './clipboard/copy';
import { createPluginRegistry } from './plugins/plugin-registry';
import { createMcpWebhookPlugin } from './plugins/mcp-webhook-plugin';
import { createThemeManager } from './toolbar/theme-manager';
import { createToolbarRenderer } from './toolbar/toolbar-renderer';
import { createHistoryPopover } from './toolbar/history-popover';
import { createActionsMenu } from './toolbar/actions-menu';
import { createCommentPopover } from './toolbar/comment-popover';
import { copyElementSnippet, copyElementHtml, copyElementStyles, copyWithComment, copyAnnotationsAsPrompt } from './toolbar/copy-actions';
import { createFreezeOverlay } from './overlay/freeze-overlay';
import { showSelectFeedback, disposeFeedbackStyles } from './overlay/select-feedback';
import { TOOLBAR_TOAST_OFFSET } from './constants';

const MAX_HISTORY = 50;

function toHistoryContext(ctx: ElementContext): HistoryContext {
  return {
    html: ctx.html,
    componentName: ctx.componentName,
    filePath: ctx.filePath,
    line: ctx.line,
    column: ctx.column,
    componentStack: ctx.componentStack,
    selector: ctx.selector,
    cssClasses: ctx.cssClasses,
    textContent: ctx.textContent,
    ariaLabel: ctx.ariaLabel,
    role: ctx.role,
    elementDescription: ctx.elementDescription,
  };
}

function getDefaultOptions(): PointGrabOptions {
  return {
    activationKey: isMac() ? 'Meta+C' : 'Ctrl+C',
    activationMode: 'hold',
    keyHoldDuration: 0,
    maxContextLines: 20,
    enabled: true,
    enableInInputs: false,
    devOnly: true,
    showToolbar: true,
    themeMode: 'dark',
    mcpWebhook: true,
    classFilters: [],
    htmlCleaners: [],
  };
}

export function init(options?: Partial<PointGrabOptions>): PointGrabAPI {
  return createPointGrabInstance(options);
}

/** Check for a generic dev mode flag. Returns true if in dev mode or if the flag is absent. */
function isDevMode(): boolean {
  try {
    const flag = (globalThis as any).__POINTGRAB_DEV__;
    return typeof flag === 'undefined' || !!flag;
  } catch {
    return true;
  }
}

/** No-op API returned when devOnly is true and the app is in production. */
export function createNoopApi(): PointGrabAPI {
  const noop = () => {};
  return {
    activate: noop,
    deactivate: noop,
    toggle: noop,
    isActive: () => false,
    setOptions: noop,
    registerPlugin: noop,
    unregisterPlugin: noop,
    setComponentResolver: noop,
    setSourceResolver: noop,
    setElementFromPoint: noop,
    showToolbar: noop,
    hideToolbar: noop,
    setThemeMode: noop,
    getHistory: () => [],
    clearHistory: noop,
    dispose: noop,
  };
}

function createPointGrabInstance(options?: Partial<PointGrabOptions>): PointGrabAPI {
  const defaults = getDefaultOptions();
  const merged: PointGrabOptions = { ...defaults, ...options };

  if (merged.devOnly && !isDevMode()) {
    return createNoopApi();
  }

  const store = createStore(merged);
  const overlay = createOverlayRenderer();
  const crosshair = createCrosshair();
  const freezeOverlay = createFreezeOverlay();
  const pluginRegistry = createPluginRegistry();
  const themeManager = createThemeManager();

  let componentResolver: ComponentResolver | null = null;
  let sourceResolver: SourceResolver | null = null;
  let elementFromPointFn: ((x: number, y: number) => Element | null) | null = null;

  // Per-instance state for last selected element (not in store to avoid serialization issues)
  let lastSelectedElement: WeakRef<Element> | null = null;
  let lastSelectedContext: ElementContext | null = null;
  let idCounter = 0;

  // Multi-comment mode state
  let annotations: Annotation[] = [];
  let commentModeActive = false;

  function nextId(): string {
    return `pointgrab-${++idCounter}-${Date.now()}`;
  }

  // Apply initial theme
  themeManager.apply(store.state.toolbar.themeMode);

  // Set toast bottom offset when toolbar is visible
  updateToastOffset();

  // --- Toolbar element check (aggregates all toolbar-related UI) ---
  function isAnyToolbarElement(el: Element): boolean {
    return toolbar.isToolbarElement(el)
      || historyPopover.isPopoverElement(el)
      || actionsMenu.isMenuElement(el)
      || commentPopover.isPopoverElement(el)
      || freezeOverlay.isFreezeElement(el);
  }

  // --- History management ---
  function addHistoryEntry(context: ElementContext, snippet: string): void {
    const entry: HistoryEntry = {
      id: nextId(),
      context: toHistoryContext(context),
      snippet,
      timestamp: Date.now(),
    };

    lastSelectedElement = new WeakRef(context.element);
    lastSelectedContext = context;

    const history = [entry, ...store.state.toolbar.history].slice(0, MAX_HISTORY);
    store.state.toolbar = { ...store.state.toolbar, history };
  }

  /** Returns the live Element if it's still connected to the DOM. */
  function getLastSelectedElement(): Element | null {
    const el = lastSelectedElement?.deref() ?? null;
    if (el && !el.isConnected) {
      lastSelectedElement = null;
      lastSelectedContext = null;
      return null;
    }
    return el;
  }

  function updateToolbar(): void {
    toolbar.update(store.state, annotations.length);
  }

  // --- Close all popovers ---
  function closeAllPopovers(): void {
    historyPopover.hide();
    actionsMenu.hide();
    commentPopover.hide();
  }

  // --- Pending action execution ---
  async function executePendingAction(pending: PendingAction, element: Element): Promise<void> {
    const classFilters = store.state.options.classFilters;
    const htmlCleaners = store.state.options.htmlCleaners;
    const context = buildElementContext(element, componentResolver, sourceResolver, classFilters, htmlCleaners);
    const maxLines = store.state.options.maxContextLines;

    lastSelectedElement = new WeakRef(element);
    lastSelectedContext = context;
    store.state.toolbar = { ...store.state.toolbar, pendingAction: null };

    switch (pending.type) {
      case 'copy-element': {
        const ok = await copyElementSnippet(context, maxLines, pluginRegistry, htmlCleaners);
        if (ok) {
          showSelectFeedback(element);
          addHistoryEntry(context, '');
        }
        break;
      }
      case 'copy-styles':
        await copyElementStyles(element);
        break;
      case 'copy-html':
        await copyElementHtml(context, pluginRegistry, htmlCleaners);
        break;
      case 'comment':
        commentPopover.show(commentModeActive ? 'multi' : 'single');
        return; // Don't deactivate — user still needs to type
    }
  }

  // --- Picker ---
  const picker = createElementPicker({
    overlay,
    crosshair,
    getComponentResolver: () => componentResolver,
    getSourceResolver: () => sourceResolver,
    getClassFilters: () => store.state.options.classFilters,
    isToolbarElement: isAnyToolbarElement,
    getFreezeElement: () => freezeOverlay.getElement(),
    getElementFromPoint: () => elementFromPointFn,
    onHover(element) {
      store.state.hoveredElement = element;
      if (element) {
        pluginRegistry.callHook('onElementHover', element);
      }
    },
    async onSelect(element) {
      const pending = store.state.toolbar.pendingAction;

      if (pending) {
        await executePendingAction(pending, element);
        // Comment flow keeps picker active
        if (pending.type !== 'comment') {
          doDeactivate();
        }
        return;
      }

      // Default copy flow
      const result = await copyElement(element, {
        getComponentResolver: () => componentResolver,
        getSourceResolver: () => sourceResolver,
        getMaxContextLines: () => store.state.options.maxContextLines,
        getClassFilters: () => store.state.options.classFilters,
        getHtmlCleaners: () => store.state.options.htmlCleaners,
        pluginRegistry,
      });

      if (result) {
        showSelectFeedback(element);
        addHistoryEntry(result.context, result.snippet);
      }
    },
  });

  function doActivate(): void {
    if (!store.state.options.enabled) return;
    if (store.state.active) return;

    // Show toolbar if it was dismissed
    if (store.state.toolbar.visible === false && store.state.options.showToolbar) {
      store.state.toolbar = { ...store.state.toolbar, visible: true };
      toolbar.show();
      updateToolbar();
    }

    store.state.active = true;
    picker.activate();
    pluginRegistry.callHook('onActivate');
    updateToolbar();
  }

  function doDeactivate(force = false): void {
    if (!store.state.active) return;

    // In hold mode, don't deactivate if the page is frozen — the user
    // explicitly asked to keep selection mode alive.
    if (!force && store.state.frozen) return;

    store.state.active = false;
    store.state.frozen = false;
    freezeOverlay.hide();

    if (commentModeActive && annotations.length === 0) {
      commentModeActive = false;
    }

    store.state.toolbar = { ...store.state.toolbar, pendingAction: null };
    picker.deactivate();
    pluginRegistry.callHook('onDeactivate');
    updateToolbar();
  }

  function toggleFreeze(): void {
    store.state.frozen = !store.state.frozen;
    if (store.state.frozen) {
      freezeOverlay.show(store.state.hoveredElement);
    } else {
      freezeOverlay.hide();
    }
    updateToolbar();
  }

  // --- Copy all annotations as a single prompt ---
  async function copyAnnotationsPrompt(): Promise<void> {
    if (annotations.length === 0) return;
    const htmlCleaners = store.state.options.htmlCleaners;
    const maxLines = store.state.options.maxContextLines;
    await copyAnnotationsAsPrompt(annotations, maxLines, pluginRegistry, htmlCleaners);
    annotations = [];
    commentModeActive = false;
    store.state.toolbar = { ...store.state.toolbar, pendingAction: null };
    closeAllPopovers();
    doDeactivate(true);
    updateToolbar();
  }

  // --- Toolbar ---
  const toolbar = createToolbarRenderer({
    onSelectionMode() {
      closeAllPopovers();
      if (store.state.active) {
        doDeactivate();
      } else {
        doActivate();
      }
    },

    onHistory() {
      actionsMenu.hide();
      commentPopover.hide();
      if (historyPopover.isVisible()) {
        historyPopover.hide();
      } else {
        historyPopover.show([...store.state.toolbar.history]);
      }
    },

    onActions() {
      historyPopover.hide();
      commentPopover.hide();
      if (actionsMenu.isVisible()) {
        actionsMenu.hide();
      } else {
        actionsMenu.show();
      }
    },

    onFreeze() {
      closeAllPopovers();
      if (!store.state.active) {
        doActivate();
      }
      toggleFreeze();
    },

    onThemeToggle() {
      const current = store.state.toolbar.themeMode;
      const newMode: ThemeMode = current === 'dark' ? 'light' : current === 'light' ? 'system' : 'dark';
      store.state.toolbar = { ...store.state.toolbar, themeMode: newMode };
      themeManager.apply(newMode);
      updateToolbar();
    },

    onEnableToggle() {
      closeAllPopovers();
      const newEnabled = !store.state.options.enabled;
      store.state.options = { ...store.state.options, enabled: newEnabled };
      if (!newEnabled) {
        doDeactivate();
      }
      updateToolbar();
    },

    onDismiss() {
      closeAllPopovers();
      doDeactivate(true);
      store.state.toolbar = { ...store.state.toolbar, visible: false };
      toolbar.hide();
    },

    onCopyPrompt() {
      closeAllPopovers();
      copyAnnotationsPrompt();
    },
  });

  // --- History Popover ---
  const historyPopover = createHistoryPopover({
    async onEntryClick(entry: HistoryEntry) {
      historyPopover.hide();
      try {
        await navigator.clipboard.writeText(entry.snippet);
        showToast('Re-copied to clipboard', {
          componentName: entry.context.componentName,
          filePath: entry.context.filePath,
          line: entry.context.line,
          column: entry.context.column,
          cssClasses: entry.context.cssClasses,
        });
      } catch {
        showToast('Failed to copy to clipboard');
      }
    },
  });

  // --- Actions Menu ---
  const actionsMenu = createActionsMenu({
    onCopyElement() {
      const htmlCleaners = store.state.options.htmlCleaners;
      if (lastSelectedContext) {
        copyElementSnippet(lastSelectedContext, store.state.options.maxContextLines, pluginRegistry, htmlCleaners);
      } else {
        store.state.toolbar = { ...store.state.toolbar, pendingAction: { type: 'copy-element' } };
        doActivate();
      }
    },

    onCopyStyles() {
      const el = getLastSelectedElement();
      if (el) {
        copyElementStyles(el);
      } else {
        store.state.toolbar = { ...store.state.toolbar, pendingAction: { type: 'copy-styles' } };
        doActivate();
      }
    },

    onCopyHtml() {
      const htmlCleaners = store.state.options.htmlCleaners;
      if (lastSelectedContext) {
        copyElementHtml(lastSelectedContext, pluginRegistry, htmlCleaners);
      } else {
        store.state.toolbar = { ...store.state.toolbar, pendingAction: { type: 'copy-html' } };
        doActivate();
      }
    },

    onComment() {
      commentModeActive = true;
      annotations = [];
      if (lastSelectedContext) {
        commentPopover.show('multi');
      } else {
        store.state.toolbar = { ...store.state.toolbar, pendingAction: { type: 'comment' } };
        doActivate();
      }
      updateToolbar();
    },

    onClearHistory() {
      lastSelectedContext = null;
      lastSelectedElement = null;
      store.state.toolbar = { ...store.state.toolbar, history: [] };
    },
  });

  // --- Comment Popover ---
  const commentPopover = createCommentPopover({
    async onSubmit(comment: string) {
      if (!lastSelectedContext) return;

      if (commentModeActive) {
        annotations.push({ context: lastSelectedContext, comment });
        showSelectFeedback(lastSelectedContext.element);
        showToast(`Annotation ${annotations.length} added`, {
          componentName: lastSelectedContext.componentName,
          filePath: lastSelectedContext.filePath,
          line: lastSelectedContext.line,
          column: lastSelectedContext.column,
          cssClasses: lastSelectedContext.cssClasses,
        });
        store.state.toolbar = { ...store.state.toolbar, pendingAction: { type: 'comment' } };
        updateToolbar();
      } else {
        const htmlCleaners = store.state.options.htmlCleaners;
        await copyWithComment(lastSelectedContext, comment, store.state.options.maxContextLines, pluginRegistry, htmlCleaners);
        if (store.state.active) {
          doDeactivate();
        }
      }
    },
    onCancel() {
      if (commentModeActive && annotations.length > 0) {
        store.state.toolbar = { ...store.state.toolbar, pendingAction: { type: 'comment' } };
      } else {
        commentModeActive = false;
        annotations = [];
        if (store.state.active) {
          doDeactivate();
        }
      }
    },
  });

  // --- Close popovers on outside click ---
  function handleDocumentClick(e: MouseEvent): void {
    const target = e.target as Element | null;
    if (!target) return;

    if (isAnyToolbarElement(target)) return;

    // Close popovers if click is outside toolbar UI
    if (historyPopover.isVisible() || actionsMenu.isVisible() || commentPopover.isVisible()) {
      closeAllPopovers();
    }
  }
  document.addEventListener('click', handleDocumentClick);

  // --- Toast offset helper ---
  function updateToastOffset(): void {
    if (store.state.toolbar.visible) {
      document.documentElement.style.setProperty('--pointgrab-toast-bottom', TOOLBAR_TOAST_OFFSET);
    } else {
      document.documentElement.style.removeProperty('--pointgrab-toast-bottom');
    }
  }

  // --- Freeze key handler (F key during selection mode) ---
  function handleFreezeKey(e: KeyboardEvent): void {
    if (e.key.toLowerCase() !== 'f') return;
    const tag = (e.target as Element)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if ((e.target as HTMLElement)?.isContentEditable) return;

    // Allow freeze when active, or when toolbar is visible (just deactivated)
    if (!store.state.active && !store.state.toolbar.visible) return;

    e.preventDefault();

    // Re-activate if needed (user pressed 'f' right after releasing activation key)
    if (!store.state.active) {
      doActivate();
    }

    toggleFreeze();
  }
  document.addEventListener('keydown', handleFreezeKey, true);

  // --- Keyboard handler ---
  const keyboard = createKeyboardHandler({
    getActivationKey: () => store.state.options.activationKey,
    getActivationMode: () => store.state.options.activationMode,
    getKeyHoldDuration: () => store.state.options.keyHoldDuration,
    getEnableInInputs: () => store.state.options.enableInInputs,
    onActivate: doActivate,
    onDeactivate: doDeactivate,
    isActive: () => store.state.active,
  });

  // Build the API object so plugins can reference it
  const api: PointGrabAPI = {
    activate: doActivate,
    deactivate: doDeactivate,

    toggle(): void {
      if (store.state.active) {
        doDeactivate();
      } else {
        doActivate();
      }
    },

    isActive(): boolean {
      return store.state.active;
    },

    setOptions(opts: Partial<PointGrabOptions>): void {
      store.state.options = { ...store.state.options, ...opts };
    },

    registerPlugin(plugin: Plugin): void {
      if (plugin.options) {
        store.state.options = { ...store.state.options, ...plugin.options };
      }
      if (plugin.theme) {
        themeManager.applyOverrides(plugin.theme);
      }
      pluginRegistry.register(plugin, api);
    },

    unregisterPlugin(name: string): void {
      pluginRegistry.unregister(name);
    },

    setComponentResolver(resolver: ComponentResolver): void {
      componentResolver = resolver;
    },

    setSourceResolver(resolver: SourceResolver): void {
      sourceResolver = resolver;
    },

    setElementFromPoint(fn: (x: number, y: number) => Element | null): void {
      elementFromPointFn = fn;
    },

    showToolbar(): void {
      store.state.toolbar = { ...store.state.toolbar, visible: true };
      toolbar.show();
      updateToolbar();
      updateToastOffset();
    },

    hideToolbar(): void {
      closeAllPopovers();
      store.state.toolbar = { ...store.state.toolbar, visible: false };
      toolbar.hide();
      updateToastOffset();
    },

    setThemeMode(mode: ThemeMode): void {
      store.state.toolbar = { ...store.state.toolbar, themeMode: mode };
      themeManager.apply(mode);
      updateToolbar();
    },

    getHistory(): HistoryEntry[] {
      return [...store.state.toolbar.history];
    },

    clearHistory(): void {
      lastSelectedContext = null;
      lastSelectedElement = null;
      store.state.toolbar = { ...store.state.toolbar, history: [] };
    },

    dispose(): void {
      doDeactivate();
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('keydown', handleFreezeKey, true);
      keyboard.dispose();
      picker.dispose();
      overlay.dispose();
      crosshair.dispose();
      freezeOverlay.dispose();
      disposeToast();
      disposeFeedbackStyles();
      pluginRegistry.dispose();
      closeAllPopovers();
      toolbar.dispose();
      historyPopover.dispose();
      actionsMenu.dispose();
      commentPopover.dispose();
      themeManager.dispose();
      document.documentElement.style.removeProperty('--pointgrab-toast-bottom');
    },
  };

  // Start listening for keyboard shortcuts
  if (store.state.options.enabled) {
    keyboard.start();
  }

  // Toolbar starts hidden — it appears when selection mode is first activated
  store.state.toolbar = { ...store.state.toolbar, visible: false };

  // React to enabled option changes
  store.subscribe((state, key) => {
    if (key === 'options') {
      if (state.options.enabled) {
        keyboard.start();
      } else {
        keyboard.stop();
        doDeactivate();
      }
    }
    if (key === 'toolbar') {
      updateToastOffset();
    }
  });

  if (merged.mcpWebhook) {
    api.registerPlugin(createMcpWebhookPlugin());
  }

  return api;
}
