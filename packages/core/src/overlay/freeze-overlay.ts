import { Z_INDEX_FREEZE } from '../constants';

const FREEZE_ID = '__point-grab-freeze-overlay__';
const FREEZE_STYLE_ID = '__point-grab-freeze-styles__';
const HOVER_STYLE_ID = '__point-grab-freeze-hover-styles__';
const ANIM_STYLE_ID = '__point-grab-freeze-anim-styles__';
const HOVER_ATTR = 'data-point-grab-hover';

/**
 * Events to block during freeze to prevent hover state changes.
 */
const MOUSE_EVENTS_TO_BLOCK = [
  'mouseenter', 'mouseleave', 'mouseover', 'mouseout',
  'pointerenter', 'pointerleave', 'pointerover', 'pointerout',
] as const;

const FOCUS_EVENTS_TO_BLOCK = ['focus', 'blur', 'focusin', 'focusout'] as const;

export interface FreezeOverlay {
  show(hoveredElement?: Element | null): void;
  hide(): void;
  isVisible(): boolean;
  isFreezeElement(el: Element): boolean;
  getElement(): HTMLDivElement | null;
  dispose(): void;
}

export function createFreezeOverlay(): FreezeOverlay {
  let overlay: HTMLDivElement | null = null;
  let visible = false;
  let hoverStyleEls: HTMLStyleElement[] = [];
  let animStyleEl: HTMLStyleElement | null = null;
  let markedElements: Element[] = [];
  let pausedAnimations: Animation[] = [];
  let shadowAnimStyleEls: HTMLStyleElement[] = [];

  function injectStyles(): void {
    if (document.getElementById(FREEZE_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = FREEZE_STYLE_ID;
    style.textContent = `
      #${FREEZE_ID} {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: ${Z_INDEX_FREEZE};
        pointer-events: auto;
        background: transparent;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureOverlay(): HTMLDivElement {
    if (overlay) return overlay;

    injectStyles();
    overlay = document.createElement('div');
    overlay.id = FREEZE_ID;
    overlay.style.display = 'none';
    document.body.appendChild(overlay);
    return overlay;
  }

  // --- Event blocking ---

  const stopEvent = (e: Event): void => {
    e.stopImmediatePropagation();
  };

  const preventFocusChange = (e: Event): void => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  function blockEvents(): void {
    for (const type of MOUSE_EVENTS_TO_BLOCK) {
      document.addEventListener(type, stopEvent, true);
    }
    for (const type of FOCUS_EVENTS_TO_BLOCK) {
      document.addEventListener(type, preventFocusChange, true);
    }
  }

  function unblockEvents(): void {
    for (const type of MOUSE_EVENTS_TO_BLOCK) {
      document.removeEventListener(type, stopEvent, true);
    }
    for (const type of FOCUS_EVENTS_TO_BLOCK) {
      document.removeEventListener(type, preventFocusChange, true);
    }
  }

  // --- Hover preservation via CSS rule cloning ---

  /** Parent element, stepping out of an open shadow root to its host. */
  function composedParent(element: Element): Element | null {
    if (element.parentElement) return element.parentElement;
    const root = element.getRootNode();
    return root instanceof ShadowRoot ? root.host : null;
  }

  /** The innermost hovered element, descending into open shadow roots. */
  function deepestHovered(): Element | null {
    let root: Document | ShadowRoot = document;
    let hovered: Element | null = null;
    for (;;) {
      const next: Element | undefined = Array.from(root.querySelectorAll(':hover')).at(-1);
      if (!next) return hovered;
      hovered = next;
      if (!next.shadowRoot) return hovered;
      root = next.shadowRoot;
    }
  }

  /** Mark the hovered element and all ancestors (across shadow roots) with [data-point-grab-hover]. */
  function markHoverChain(element: Element): Set<Document | ShadowRoot> {
    const roots = new Set<Document | ShadowRoot>();
    let current: Element | null = element;
    while (current && current !== document.documentElement) {
      current.setAttribute(HOVER_ATTR, '');
      markedElements.push(current);
      const root = current.getRootNode();
      if (root instanceof ShadowRoot || root instanceof Document) roots.add(root);
      // `:host(:hover)` rules live in the host's own shadow root, not the tree it sits in.
      if (current.shadowRoot) roots.add(current.shadowRoot);
      current = composedParent(current);
    }
    return roots;
  }

  function clearHoverMarks(): void {
    for (const el of markedElements) {
      el.removeAttribute(HOVER_ATTR);
    }
    markedElements = [];
  }

  /**
   * Clone :hover rules as [data-point-grab-hover] rules in every tree scope on the
   * hover chain (the document and each open shadow root), including adopted sheets.
   * This preserves hover-dependent visibility of child elements
   * (e.g. `.trigger:hover .tooltip { display: block }`, `:host(:hover) .panel`)
   * which computed-style snapshotting alone cannot handle.
   */
  function injectHoverRules(roots: Iterable<Document | ShadowRoot>): void {
    if (hoverStyleEls.length) return;
    for (const root of roots) {
      const cloned: string[] = [];
      for (const sheet of [...Array.from(root.styleSheets), ...(root.adoptedStyleSheets ?? [])]) {
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          continue; // cross-origin stylesheet
        }
        collectHoverRules(rules, cloned);
      }
      if (cloned.length === 0) continue;
      const style = document.createElement('style');
      style.id = HOVER_STYLE_ID;
      style.textContent = cloned.join('\n');
      (root instanceof Document ? root.head : root).appendChild(style);
      hoverStyleEls.push(style);
    }
  }

  function collectHoverRules(rules: CSSRuleList, out: string[]): void {
    const len = rules.length;
    for (let i = 0; i < len; i++) {
      const rule = rules[i];
      if (!rule) continue;
      if (rule instanceof CSSStyleRule) {
        if (rule.selectorText.includes(':hover')) {
          const newSelector = rule.selectorText.replace(/:hover/g, `[${HOVER_ATTR}]`);
          out.push(`${newSelector} { ${rule.style.cssText} }`);
        }
      } else if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
        // @media, @supports, @container, @layer (e.g. Tailwind v4 `hover:` utilities live in
        // `@layer utilities { @media (hover: hover) { ... } }`). Re-emit with the same prelude
        // so conditions and cascade layer order are preserved.
        const inner: string[] = [];
        collectHoverRules((rule as CSSGroupingRule).cssRules, inner);
        if (inner.length > 0) {
          const prelude = rule.cssText.slice(0, rule.cssText.indexOf('{')).trim();
          out.push(`${prelude} { ${inner.join('\n')} }`);
        }
      }
    }
  }

  function removeHoverRules(): void {
    for (const style of hoverStyleEls) style.remove();
    hoverStyleEls = [];
  }

  // --- Animation freezing ---

  function freezeAnimations(): void {
    if (animStyleEl) return;

    // Pause at the current timeline position, including CSS transitions and WAAPI.
    // Disabling transitions would jump to their final value instead of freezing.
    // Document.getAnimations() excludes shadow trees. Visit every open root,
    // including nested hosts, and deduplicate in case a browser includes it twice.
    const animations = new Set<Animation>();
    const shadowRoots: ShadowRoot[] = [];
    const collectAnimations = (root: Document | ShadowRoot): void => {
      for (const animation of root.getAnimations?.() ?? []) animations.add(animation);
      for (const element of root.querySelectorAll('*')) {
        if (element.shadowRoot && !isPointGrabNode(element)) {
          shadowRoots.push(element.shadowRoot);
          collectAnimations(element.shadowRoot);
        }
      }
    };
    collectAnimations(document);
    // Never pause Point Grab's own UI: closing the menu/toolbar starts a fade-out
    // transition immediately before freezing, which would otherwise stay on screen.
    pausedAnimations = [...animations].filter(animation => {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      return animation.playState === 'running' && !(target && isPointGrabNode(target));
    });
    for (const animation of pausedAnimations) animation.pause();

    animStyleEl = document.createElement('style');
    animStyleEl.id = ANIM_STYLE_ID;
    animStyleEl.textContent = `
      :not([id^="__point-grab-"], [id^="__point-grab-"] *),
      :not([id^="__point-grab-"], [id^="__point-grab-"] *)::before,
      :not([id^="__point-grab-"], [id^="__point-grab-"] *)::after {
        animation-play-state: paused !important;
      }
    `;
    document.head.appendChild(animStyleEl);
    // Document styles don't reach into shadow trees: pause animations that start
    // inside open shadow roots while frozen, too.
    for (const root of shadowRoots) {
      const style = animStyleEl.cloneNode(true) as HTMLStyleElement;
      root.appendChild(style);
      shadowAnimStyleEls.push(style);
    }
  }

  function unfreezeAnimations(): void {
    animStyleEl?.remove();
    animStyleEl = null;
    for (const style of shadowAnimStyleEls) style.remove();
    shadowAnimStyleEls = [];
    for (const animation of pausedAnimations) {
      if (animation.playState !== 'idle' && animation.playState !== 'finished') animation.play();
    }
    pausedAnimations = [];
  }

  // --- DOM mutation freezing ---
  // Reverts JS-driven DOM changes (setInterval, setTimeout, rAF callbacks)
  // by observing and undoing mutations while the page is frozen.

  let mutationObserver: MutationObserver | null = null;
  let observedRoots: Node[] = [];

  function isPointGrabNode(node: Node): boolean {
    // html2canvas's temporary rendering iframe is infrastructure, not page state.
    if (node instanceof Element && node.closest('.html2canvas-container')) return true;
    if (node instanceof HTMLElement) {
      const id = node.id || '';
      if (id.startsWith('__point-grab-')) return true;
    }
    // Walk up to check if the mutation target is inside a point-grab element
    let current: Node | null = node;
    while (current) {
      if (current instanceof HTMLElement && (current.id || '').startsWith('__point-grab-')) return true;
      // Cross open shadow boundaries so UI rendered inside a host is recognized.
      current = current.parentNode ?? (current instanceof ShadowRoot ? current.host : null);
    }
    return false;
  }

  function freezeDom(): void {
    if (mutationObserver) return;
    observedRoots = [document.body];
    const collectRoots = (root: ParentNode): void => {
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) { observedRoots.push(el.shadowRoot); collectRoots(el.shadowRoot); }
      }
    };
    collectRoots(document.body);

    mutationObserver = new MutationObserver((mutations) => {
      // Temporarily disconnect to avoid infinite loop while reverting
      mutationObserver?.disconnect();

      // Undo in reverse order: later oldValues are intermediate, not the snapshot.
      for (const mutation of mutations.reverse()) {
        if (isPointGrabNode(mutation.target)) continue;

        if (mutation.type === 'characterData') {
          mutation.target.textContent = mutation.oldValue;
        } else if (mutation.type === 'attributes') {
          const el = mutation.target as Element;
          if (mutation.attributeName === HOVER_ATTR) continue;
          if (mutation.oldValue === null) {
            el.removeAttribute(mutation.attributeName!);
          } else {
            el.setAttribute(mutation.attributeName!, mutation.oldValue);
          }
        } else if (mutation.type === 'childList') {
          const addedNodes = mutation.addedNodes;
          const addedLen = addedNodes.length;
          for (let i = 0; i < addedLen; i++) {
            const added = addedNodes[i];
            if (!added || isPointGrabNode(added)) continue;
            added.parentNode?.removeChild(added);
          }

          const removedNodes = mutation.removedNodes;
          const removedLen = removedNodes.length;
          for (let i = 0; i < removedLen; i++) {
            const removed = removedNodes[i];
            if (!removed || isPointGrabNode(removed)) continue;
            if (mutation.nextSibling?.parentNode === mutation.target) {
              mutation.target.insertBefore(removed, mutation.nextSibling);
            } else {
              mutation.target.appendChild(removed);
            }
          }
        }
      }

      // Re-observe after reverting
      observeBody();
    });

    observeBody();
  }

  function observeBody(): void {
    // subtree observation alone does not cross open shadow boundaries.
    for (const root of observedRoots) mutationObserver?.observe(root, {
      childList: true, subtree: true, attributes: true, attributeOldValue: true,
      characterData: true, characterDataOldValue: true,
    });
  }

  function unfreezeDom(): void {
    mutationObserver?.disconnect();
    mutationObserver = null;
    observedRoots = [];
  }

  return {
    show(hoveredElement?: Element | null): void {
      if (visible) return;
      // Activation can precede the picker's first mousemove. Preserve the real
      // browser hover chain rather than requiring a previously picked element.
      hoveredElement ??= deepestHovered();
      // 1. Block mouse/focus events to prevent hover state changes
      blockEvents();

      // 2. Preserve hover state via CSS rule cloning BEFORE overlay steals hover
      if (hoveredElement) injectHoverRules(markHoverChain(hoveredElement));

      // 3. Freeze CSS animations and DOM mutations
      freezeAnimations();
      freezeDom();

      // 4. Show overlay to block clicks/scrolls
      const el = ensureOverlay();
      el.style.display = 'block';
      visible = true;
    },

    hide(): void {
      // Disconnect the mutation observer first so it doesn't revert our own cleanup.
      unfreezeDom();
      if (overlay) overlay.style.display = 'none';
      visible = false;
      clearHoverMarks();
      removeHoverRules();
      unfreezeAnimations();
      unblockEvents();
    },

    isVisible(): boolean {
      return visible;
    },

    isFreezeElement(el: Element): boolean {
      return el === overlay || el.id === FREEZE_ID;
    },

    getElement(): HTMLDivElement | null {
      return overlay;
    },

    dispose(): void {
      unfreezeDom();
      clearHoverMarks();
      removeHoverRules();
      unfreezeAnimations();
      unblockEvents();
      overlay?.remove();
      document.getElementById(FREEZE_STYLE_ID)?.remove();
      overlay = null;
      visible = false;
    },
  };
}
