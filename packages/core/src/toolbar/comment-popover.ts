import { Z_INDEX_POPOVER, TOOLBAR_POPOVER_OFFSET } from '../constants';

const POPOVER_ID = '__pointgrab-comment-popover__';
const STYLE_ID = '__pointgrab-comment-styles__';

export interface CommentPopover {
  show(mode?: 'single' | 'multi'): void;
  hide(): void;
  isVisible(): boolean;
  isPopoverElement(el: Element): boolean;
  dispose(): void;
}

export interface CommentPopoverCallbacks {
  onSubmit: (comment: string) => void;
  onCancel: () => void;
}

export function createCommentPopover(callbacks: CommentPopoverCallbacks): CommentPopover {
  let popover: HTMLDivElement | null = null;
  let textarea: HTMLTextAreaElement | null = null;
  let submitBtn: HTMLButtonElement | null = null;
  let visible = false;
  let currentMode: 'single' | 'multi' = 'single';
  let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  function injectStyles(): void {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${POPOVER_ID} {
        position: fixed;
        bottom: ${TOOLBAR_POPOVER_OFFSET};
        left: 50%;
        transform: translateX(-50%);
        z-index: ${Z_INDEX_POPOVER};
        background: var(--point-grab-popover-bg, #0f172a);
        border: 1px solid var(--point-grab-popover-border, #1e293b);
        border-radius: 12px;
        box-shadow: 0 8px 24px var(--point-grab-popover-shadow, rgba(0, 0, 0, 0.5));
        width: 340px;
        padding: 14px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.15s ease, visibility 0.15s ease;
        pointer-events: auto;
      }
      #${POPOVER_ID}.point-grab-comment-visible {
        opacity: 1;
        visibility: visible;
      }
      #${POPOVER_ID} textarea {
        width: 100%;
        min-height: 80px;
        padding: 8px 10px;
        border: 1px solid var(--point-grab-popover-border, #1e293b);
        border-radius: 8px;
        background: var(--point-grab-surface, #1e293b);
        color: var(--point-grab-popover-text, #e2e8f0);
        font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        resize: vertical;
        outline: none;
        box-sizing: border-box;
      }
      #${POPOVER_ID} textarea:focus {
        border-color: var(--point-grab-accent, #3b82f6);
      }
      #${POPOVER_ID} textarea::placeholder {
        color: var(--point-grab-text-muted, #64748b);
      }
      #${POPOVER_ID} .point-grab-comment-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 10px;
      }
      #${POPOVER_ID} .point-grab-comment-btn {
        padding: 6px 14px;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s ease;
      }
      #${POPOVER_ID} .point-grab-comment-cancel {
        background: transparent;
        color: var(--point-grab-text-muted, #64748b);
      }
      #${POPOVER_ID} .point-grab-comment-cancel:hover {
        background: var(--point-grab-popover-hover, #1e293b);
        color: var(--point-grab-popover-text, #e2e8f0);
      }
      #${POPOVER_ID} .point-grab-comment-submit {
        background: var(--point-grab-accent, #3b82f6);
        color: #fff;
      }
      #${POPOVER_ID} .point-grab-comment-submit:hover {
        background: var(--point-grab-accent-hover, #2563eb);
      }
    `;
    document.head.appendChild(style);
  }

  function ensurePopover(): HTMLDivElement {
    if (popover) return popover;

    injectStyles();

    popover = document.createElement('div');
    popover.id = POPOVER_ID;
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'Add comment');

    textarea = document.createElement('textarea');
    textarea.placeholder = 'Add a comment...';
    textarea.rows = 3;

    const footer = document.createElement('div');
    footer.className = 'point-grab-comment-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'point-grab-comment-btn point-grab-comment-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      doHide();
      callbacks.onCancel();
    });

    submitBtn = document.createElement('button');
    submitBtn.className = 'point-grab-comment-btn point-grab-comment-submit';
    submitBtn.textContent = 'Copy with Comment';
    submitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const comment = textarea!.value.trim();
      if (comment) {
        doHide();
        callbacks.onSubmit(comment);
      } else {
        textarea!.style.borderColor = 'var(--point-grab-accent, #3b82f6)';
        textarea!.setAttribute('placeholder', 'Please enter a comment...');
        textarea!.focus();
        setTimeout(() => {
          if (textarea) {
            textarea.style.borderColor = '';
            textarea.setAttribute('placeholder', 'Add a comment...');
          }
        }, 2000);
      }
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(submitBtn);
    popover.appendChild(textarea);
    popover.appendChild(footer);

    document.body.appendChild(popover);
    return popover;
  }

  function attachKeydownInterceptor(): void {
    if (keydownHandler) return;

    keydownHandler = (e: KeyboardEvent) => {
      // When textarea is focused, prevent keyboard handler from intercepting
      if (textarea && document.activeElement === textarea) {
        e.stopImmediatePropagation();

        if (e.key === 'Escape') {
          doHide();
          callbacks.onCancel();
        }
      }
    };

    document.addEventListener('keydown', keydownHandler, true);
  }

  function detachKeydownInterceptor(): void {
    if (keydownHandler) {
      document.removeEventListener('keydown', keydownHandler, true);
      keydownHandler = null;
    }
  }

  function doHide(): void {
    visible = false;
    popover?.classList.remove('point-grab-comment-visible');
    detachKeydownInterceptor();
  }

  return {
    show(mode?: 'single' | 'multi'): void {
      const el = ensurePopover();
      currentMode = mode ?? 'single';
      textarea!.value = '';
      if (submitBtn) {
        submitBtn.textContent = currentMode === 'multi' ? 'Add Comment' : 'Copy with Comment';
      }
      visible = true;
      void el.offsetHeight;
      el.classList.add('point-grab-comment-visible');
      attachKeydownInterceptor();
      requestAnimationFrame(() => textarea?.focus());
    },

    hide(): void {
      doHide();
    },

    isVisible(): boolean {
      return visible;
    },

    isPopoverElement(el: Element): boolean {
      if (!popover) return false;
      let current: Element | null = el;
      while (current) {
        if (current === popover || current.id === POPOVER_ID) return true;
        current = current.parentElement;
      }
      return false;
    },

    dispose(): void {
      detachKeydownInterceptor();
      popover?.remove();
      document.getElementById(STYLE_ID)?.remove();
      popover = null;
      textarea = null;
      submitBtn = null;
      visible = false;
    },
  };
}
