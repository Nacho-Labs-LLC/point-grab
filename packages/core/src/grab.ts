import type {
  PointGrabOptions,
  PointGrabAPI,
  Plugin,
  ComponentResolver,
  SourceResolver,
  ElementContext,
  HistoryContext,
  HistoryEntry,
  ThemeMode,
  PendingAction,
  Annotation,
  CaptureSessionAction,
  CaptureSessionEventDetail,
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
import { createCaptureSession } from './capture-session';
import { createThemeManager } from './toolbar/theme-manager';
import { createToolbarRenderer } from './toolbar/toolbar-renderer';
import { createHistoryPopover } from './toolbar/history-popover';
import { createActionsMenu } from './toolbar/actions-menu';
import { createCommentPopover } from './toolbar/comment-popover';
import { copyElementSnippet, copyElementHtml, copyElementStyles, copyWithComment, copyAnnotationsAsPrompt } from './toolbar/copy-actions';
import { createFreezeOverlay } from './overlay/freeze-overlay';
import { showSelectFeedback, disposeFeedbackStyles } from './overlay/select-feedback';
import { createCaptureMarkers } from './overlay/capture-markers';
import { TOOLBAR_TOAST_OFFSET } from './constants';

const MAX_HISTORY = 50;
const CAPTURE_SESSION_EVENT = 'point-grab:capture-session';

export function createCaptureSessionEventDetail(
  action: CaptureSessionAction,
  annotations: readonly Annotation[],
  target?: ElementContext,
): CaptureSessionEventDetail {
  return { action, annotationCount: annotations.length, annotations: [...annotations], target };
}

function emitCaptureSessionEvent(action: CaptureSessionAction, annotations: readonly Annotation[], target?: ElementContext): void {
  window.dispatchEvent(new CustomEvent<CaptureSessionEventDetail>(CAPTURE_SESSION_EVENT, {
    detail: createCaptureSessionEventDetail(action, annotations, target),
  }));
}

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
    activationKey: isMac() ? 'Meta+Shift+C' : 'Ctrl+Shift+C',
    activationMode: 'toggle',
    keyHoldDuration: 0,
    maxContextLines: 20,
    maxCaptureCount: 3,
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
    const flag = (globalThis as any).__POINT_GRAB_DEV__;
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

  // One explicit session owns the repeated target → comment → continue flow.
  const captureSession = createCaptureSession();
  const captureMarkers = createCaptureMarkers();
  const capturePoints: Array<{ x: number; y: number }> = [];
  let editingIndex: number | null = null;
  let lastCapturePoint: { x: number; y: number } | null = null;

  function nextId(): string {
    return `point-grab-${++idCounter}-${Date.now()}`;
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
      || captureMarkers.isMarkerElement(el)
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
    toolbar.update(store.state, captureSession.getAnnotations().length, captureSession.isActive());
  }

  async function syncCapturePrompt(): Promise<void> {
    const annotations = [...captureSession.getAnnotations()];
    if (annotations.length > 0) {
      await copyAnnotationsAsPrompt(annotations, store.state.options.maxContextLines, pluginRegistry, store.state.options.htmlCleaners);
    }
    emitCaptureSessionEvent('updated', annotations);
    updateToolbar();
  }

  function renderCaptureMarkers(): void {
    captureMarkers.clear();
    capturePoints.forEach((point, index) => {
      captureMarkers.add(point.x, point.y, index + 1, () => {
        const annotation = captureSession.getAnnotations()[index];
        if (!annotation) return;
        editingIndex = index;
        commentPopover.show('multi', point, {
          comment: annotation.comment,
          onDelete: () => {
            captureSession.remove(index);
            capturePoints.splice(index, 1);
            editingIndex = null;
            renderCaptureMarkers();
            void syncCapturePrompt();
          },
        });
      });
    });
  }

  // --- Close all popovers ---
  function closeAllPopovers(): void {
    historyPopover.hide();
    actionsMenu.hide();
    commentPopover.hide();
  }

  // --- Pending action execution ---
  async function executePendingAction(pending: PendingAction, element: Element, point?: { x: number; y: number }): Promise<void> {
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
        lastCapturePoint = point ?? null;
        commentPopover.show(captureSession.isActive() ? 'multi' : 'single', point);
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
    async onSelect(element, point) {
      const pending = store.state.toolbar.pendingAction;

      if (pending) {
        await executePendingAction(pending, element, point);
        // Comment flow keeps picker active
        if (pending.type !== 'comment') {
          doDeactivate();
        }
        return;
      }

      // Capture sessions preserve the selected target while its contextual actions are shown.
      if (captureSession.isActive()) {
        if (captureSession.getAnnotations().length >= store.state.options.maxCaptureCount) {
          showToast(`Capture limit reached (${store.state.options.maxCaptureCount}). End Capture Mode to finish.`);
          return;
        }
        const context = buildElementContext(
          element,
          componentResolver,
          sourceResolver,
          store.state.options.classFilters,
          store.state.options.htmlCleaners,
        );
        lastSelectedElement = new WeakRef(element);
        lastSelectedContext = context;
        lastCapturePoint = point;
        actionsMenu.show(point);
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

    // Capture mode is a deliberate session, not tied to holding the shortcut.
    if (!force && captureSession.isActive()) return;

    store.state.active = false;
    store.state.frozen = false;
    freezeOverlay.hide();

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

  function startCaptureMode(): void {
    if (!captureSession.isActive()) {
      captureSession.start();
      captureMarkers.clear();
      capturePoints.length = 0;
    }
    doActivate();
    updateToolbar();
  }

  // --- End an explicit capture session ---
  async function endCaptureMode(): Promise<void> {
    const annotations = captureSession.end();
    if (annotations.length > 0) {
      const htmlCleaners = store.state.options.htmlCleaners;
      const maxLines = store.state.options.maxContextLines;
      await copyAnnotationsAsPrompt(annotations, maxLines, pluginRegistry, htmlCleaners);
    }
    emitCaptureSessionEvent('ended', annotations);
    captureMarkers.clear();
    capturePoints.length = 0;
    editingIndex = null;
    lastCapturePoint = null;
    store.state.toolbar = { ...store.state.toolbar, pendingAction: null };
    closeAllPopovers();
    doDeactivate(true);
    updateToolbar();
  }

  // --- Toolbar ---
  const toolbar = createToolbarRenderer({
    onSelectionMode() {
      closeAllPopovers();
      startCaptureMode();
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
      if (captureSession.isActive()) captureSession.end();
      captureMarkers.clear();
      capturePoints.length = 0;
      editingIndex = null;
      lastCapturePoint = null;
      doDeactivate(true);
      store.state.toolbar = { ...store.state.toolbar, visible: false };
      toolbar.hide();
    },

    onCopyPrompt() {
      void endCaptureMode();
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
  async function addSelectedToReview(comment: string): Promise<void> {
    if (!lastSelectedContext || !captureSession.isActive()) return;
    captureSession.accept(lastSelectedContext, comment);
    if (lastCapturePoint) {
      capturePoints.push(lastCapturePoint);
      lastCapturePoint = null;
      renderCaptureMarkers();
    }
    showSelectFeedback(lastSelectedContext.element);
    await syncCapturePrompt();
    emitCaptureSessionEvent('accepted', captureSession.getAnnotations(), lastSelectedContext);
    doActivate();
  }

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

    onAddToReview(comment: string) {
      void addSelectedToReview(comment);
    },

    onCancel() {
      lastCapturePoint = null;
    },
  });

  // --- Comment Popover ---
  const commentPopover = createCommentPopover({
    async onSubmit(comment: string) {
      if (!lastSelectedContext) return;

      if (captureSession.isActive()) {
        const isEditing = editingIndex !== null;
        if (isEditing) {
          captureSession.updateComment(editingIndex!, comment);
          editingIndex = null;
        } else {
          captureSession.accept(lastSelectedContext, comment);
          if (lastCapturePoint) {
            capturePoints.push(lastCapturePoint);
            lastCapturePoint = null;
            renderCaptureMarkers();
          }
        }
        showSelectFeedback(lastSelectedContext.element);
        const htmlCleaners = store.state.options.htmlCleaners;
        await copyAnnotationsAsPrompt(
          [...captureSession.getAnnotations()],
          store.state.options.maxContextLines,
          pluginRegistry,
          htmlCleaners,
        );
        emitCaptureSessionEvent(isEditing ? 'updated' : 'accepted', captureSession.getAnnotations(), lastSelectedContext);
        store.state.toolbar = { ...store.state.toolbar, pendingAction: { type: 'comment' } };
        doActivate();
        updateToolbar();
      } else {
        const htmlCleaners = store.state.options.htmlCleaners;
        await copyWithComment(lastSelectedContext, comment, store.state.options.maxContextLines, pluginRegistry, htmlCleaners);
        if (store.state.active) doDeactivate();
      }
    },
    onCancel() {
      if (captureSession.isActive() && editingIndex !== null) {
        editingIndex = null;
        doActivate();
        return;
      }
      if (captureSession.isActive()) {
        captureSession.skip();
        lastCapturePoint = null;
        emitCaptureSessionEvent('skipped', captureSession.getAnnotations(), lastSelectedContext ?? undefined);
        store.state.toolbar = { ...store.state.toolbar, pendingAction: { type: 'comment' } };
        doActivate();
        updateToolbar();
      } else if (store.state.active) {
        doDeactivate();
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
      document.documentElement.style.setProperty('--point-grab-toast-bottom', TOOLBAR_TOAST_OFFSET);
    } else {
      document.documentElement.style.removeProperty('--point-grab-toast-bottom');
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
    onActivate: startCaptureMode,
    onDeactivate: () => {
      if (captureSession.isActive() && store.state.options.activationMode === 'toggle') {
        void endCaptureMode();
      } else if (!captureSession.isActive()) {
        doDeactivate();
      }
    },
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
      captureMarkers.dispose();
      pluginRegistry.dispose();
      closeAllPopovers();
      toolbar.dispose();
      historyPopover.dispose();
      actionsMenu.dispose();
      commentPopover.dispose();
      themeManager.dispose();
      document.documentElement.style.removeProperty('--point-grab-toast-bottom');
    },
  };

  // Start listening for keyboard shortcuts
  if (store.state.options.enabled) {
    keyboard.start();
  }

  // Keep the main toolbar hidden until capture starts, but create the subtle
  // bottom capture affordance immediately for mouse-first discovery.
  store.state.toolbar = { ...store.state.toolbar, visible: false };
  if (merged.showToolbar) {
    toolbar.show();
    toolbar.hide();
    updateToolbar();
  }

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
