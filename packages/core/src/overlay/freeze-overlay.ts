import { Z_INDEX_FREEZE } from '../constants';

const FREEZE_ID = '__pointgrab-freeze-overlay__';
const FREEZE_STYLE_ID = '__pointgrab-freeze-styles__';
const HOVER_STYLE_ID = '__pointgrab-freeze-hover-styles__';
const ANIM_STYLE_ID = '__pointgrab-freeze-anim-styles__';
const HOVER_ATTR = 'data-pointgrab-hover';

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

  /** Mark the hovered element and all ancestors with [data-pointgrab-hover]. */
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
   * Walk all stylesheets and clone :hover rules as [data-pointgrab-hover] rules.
   * This preserves hover-dependent visibility of child elements
   * (e.g. `.trigger:hover .tooltip { display: block }`) which
   * computed-style snapshotting alone cannot handle.
   */
  function injectHoverRules(): void {
    if (hoverStyleEl) return;

    const cloned: string[] = [];

    for (const sheet of Array.from(document.styleSheets)) {
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
    for (const rule of Array.from(rules)) {
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

  return {
    show(hoveredElement?: Element | null): void {
      // 1. Block mouse/focus events to prevent hover state changes
      blockEvents();

      // 2. Preserve hover state via CSS rule cloning BEFORE overlay steals hover
      if (hoveredElement) {
        markHoverChain(hoveredElement);
        injectHoverRules();
      }

      // 3. Freeze animations so nothing moves while page is frozen
      freezeAnimations();

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
      unblockEvents();
      overlay?.remove();
      document.getElementById(FREEZE_STYLE_ID)?.remove();
      overlay = null;
      visible = false;
    },
  };
}
