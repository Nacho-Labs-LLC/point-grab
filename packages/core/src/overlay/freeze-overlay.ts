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
  let hoverStyleEl: HTMLStyleElement | null = null;
  let animStyleEl: HTMLStyleElement | null = null;
  let markedElements: Element[] = [];

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

  /** Mark the hovered element and all ancestors with [data-point-grab-hover]. */
  function markHoverChain(element: Element): void {
    let current: Element | null = element;
    while (current && current !== document.documentElement) {
      current.setAttribute(HOVER_ATTR, '');
      markedElements.push(current);
      current = current.parentElement;
    }
  }

  function clearHoverMarks(): void {
    for (const el of markedElements) {
      el.removeAttribute(HOVER_ATTR);
    }
    markedElements = [];
  }

  /**
   * Walk all stylesheets and clone :hover rules as [data-point-grab-hover] rules.
   * This preserves hover-dependent visibility of child elements
   * (e.g. `.trigger:hover .tooltip { display: block }`) which
   * computed-style snapshotting alone cannot handle.
   */
  function injectHoverRules(): void {
    if (hoverStyleEl) return;

    const cloned: string[] = [];
    const sheets = document.styleSheets;
    const len = sheets.length;

    for (let i = 0; i < len; i++) {
      const sheet = sheets[i];
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // cross-origin stylesheet
      }
      collectHoverRules(rules, cloned);
    }

    if (cloned.length === 0) return;

    hoverStyleEl = document.createElement('style');
    hoverStyleEl.id = HOVER_STYLE_ID;
    hoverStyleEl.textContent = cloned.join('\n');
    document.head.appendChild(hoverStyleEl);
  }

  function collectHoverRules(rules: CSSRuleList, out: string[]): void {
    const len = rules.length;
    for (let i = 0; i < len; i++) {
      const rule = rules[i];
      if (rule instanceof CSSStyleRule) {
        if (rule.selectorText.includes(':hover')) {
          const newSelector = rule.selectorText.replace(/:hover/g, `[${HOVER_ATTR}]`);
          out.push(`${newSelector} { ${rule.style.cssText} }`);
        }
      } else if (rule instanceof CSSMediaRule) {
        const inner: string[] = [];
        collectHoverRules(rule.cssRules, inner);
        if (inner.length > 0) {
          out.push(`@media ${rule.conditionText} { ${inner.join('\n')} }`);
        }
      }
    }
  }

  function removeHoverRules(): void {
    hoverStyleEl?.remove();
    hoverStyleEl = null;
  }

  // --- Animation freezing ---

  function freezeAnimations(): void {
    if (animStyleEl) return;

    animStyleEl = document.createElement('style');
    animStyleEl.id = ANIM_STYLE_ID;
    animStyleEl.textContent = `
      *, *::before, *::after {
        animation-play-state: paused !important;
        transition: none !important;
      }
    `;
    document.head.appendChild(animStyleEl);
  }

  function unfreezeAnimations(): void {
    animStyleEl?.remove();
    animStyleEl = null;
  }

  // --- DOM mutation freezing ---
  // Reverts JS-driven DOM changes (setInterval, setTimeout, rAF callbacks)
  // by observing and undoing mutations while the page is frozen.

  let mutationObserver: MutationObserver | null = null;

  function isPointGrabNode(node: Node): boolean {
    if (node instanceof HTMLElement) {
      const id = node.id || '';
      if (id.startsWith('__point-grab-')) return true;
    }
    // Walk up to check if the mutation target is inside a point-grab element
    let current: Node | null = node;
    while (current) {
      if (current instanceof HTMLElement && (current.id || '').startsWith('__point-grab-')) return true;
      current = current.parentNode;
    }
    return false;
  }

  function freezeDom(): void {
    if (mutationObserver) return;

    mutationObserver = new MutationObserver((mutations) => {
      // Temporarily disconnect to avoid infinite loop while reverting
      mutationObserver?.disconnect();

      for (const mutation of mutations) {
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
            if (isPointGrabNode(added)) continue;
            added.parentNode?.removeChild(added);
          }

          const removedNodes = mutation.removedNodes;
          const removedLen = removedNodes.length;
          for (let i = 0; i < removedLen; i++) {
            const removed = removedNodes[i];
            if (isPointGrabNode(removed)) continue;
            if (mutation.nextSibling) {
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
    mutationObserver?.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      characterData: true,
      characterDataOldValue: true,
    });
  }

  function unfreezeDom(): void {
    mutationObserver?.disconnect();
    mutationObserver = null;
  }

  return {
    show(hoveredElement?: Element | null): void {
      // 1. Block mouse/focus events to prevent hover state changes
      blockEvents();

      // 2. Preserve hover state via CSS rule cloning BEFORE overlay steals hover
      if (hoveredElement) {
        markHoverChain(hoveredElement);
        injectHoverRules();
      }

      // 3. Freeze CSS animations and DOM mutations
      freezeAnimations();
      freezeDom();

      // 4. Show overlay to block clicks/scrolls
      const el = ensureOverlay();
      el.style.display = 'block';
      visible = true;
    },

    hide(): void {
      if (overlay) overlay.style.display = 'none';
      visible = false;
      clearHoverMarks();
      removeHoverRules();
      unfreezeAnimations();
      unfreezeDom();
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
      clearHoverMarks();
      removeHoverRules();
      unfreezeAnimations();
      unfreezeDom();
      unblockEvents();
      overlay?.remove();
      document.getElementById(FREEZE_STYLE_ID)?.remove();
      overlay = null;
      visible = false;
    },
  };
}
