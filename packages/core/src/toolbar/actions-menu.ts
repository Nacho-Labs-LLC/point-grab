import { ICON_CODE, ICON_COMMENT, ICON_COPY, ICON_STYLES } from './toolbar-icons';
import { Z_INDEX_POPOVER } from '../constants';

const MENU_ID = '__point-grab-actions-menu__';
const STYLE_ID = '__point-grab-actions-styles__';
const MAX_COMMENT_LENGTH = 500;

export interface ActionsMenuCallbacks {
  onCopyElement: () => void;
  onCopyStyles: () => void;
  onCopyHtml: () => void;
  onAddToReview: (comment: string) => void;
  onCancel: () => void;
}

export interface ActionsMenu {
  show(anchor?: { x: number; y: number }): void;
  hide(): void;
  isVisible(): boolean;
  isMenuElement(el: Element): boolean;
  dispose(): void;
}

export function createActionsMenu(callbacks: ActionsMenuCallbacks): ActionsMenu {
  let menu: HTMLDivElement | null = null;
  let visible = false;
  let keydownHandler: ((event: KeyboardEvent) => void) | null = null;

  function injectStyles(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${MENU_ID} { position: fixed; z-index: ${Z_INDEX_POPOVER}; min-width: 220px; padding: 6px; border: 1px solid var(--point-grab-popover-border, #1e293b); border-radius: 10px; background: var(--point-grab-popover-bg, #0f172a); box-shadow: 0 8px 24px var(--point-grab-popover-shadow, rgba(0,0,0,.5)); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; opacity: 0; visibility: hidden; pointer-events: auto; }
      #${MENU_ID}.point-grab-menu-visible { opacity: 1; visibility: visible; }
      #${MENU_ID} button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 12px; border: 0; border-radius: 6px; background: transparent; color: var(--point-grab-popover-text, #e2e8f0); font-size: 13px; text-align: left; cursor: pointer; }
      #${MENU_ID} button:hover { background: var(--point-grab-popover-hover, #1e293b); }
      #${MENU_ID} button:disabled { opacity: .45; cursor: not-allowed; }
      #${MENU_ID} textarea { box-sizing: border-box; width: 100%; min-height: 72px; margin: 4px 0; padding: 8px; border: 1px solid var(--point-grab-popover-border, #1e293b); border-radius: 6px; background: var(--point-grab-surface, #1e293b); color: var(--point-grab-popover-text, #e2e8f0); font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; resize: vertical; }
      #${MENU_ID} .point-grab-review-footer { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
      #${MENU_ID} .point-grab-review-footer button { width: auto; }
      #${MENU_ID} [data-point-grab-comment-count] { margin-left: auto; color: var(--point-grab-text-muted, #94a3b8); font-size: 11px; }
    `;
    document.head.appendChild(style);
  }

  function hide(): void {
    visible = false;
    menu?.classList.remove('point-grab-menu-visible');
    if (keydownHandler) document.removeEventListener('keydown', keydownHandler, true);
    keydownHandler = null;
  }

  function actionButton(label: string, action: string, icon: string | null, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'menuitem');
    button.setAttribute('data-point-grab-action', action);
    if (icon) {
      const iconContainer = document.createElement('span');
      iconContainer.innerHTML = icon;
      if (iconContainer.firstElementChild) button.appendChild(iconContainer.firstElementChild);
    }
    button.append(label);
    button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); onClick(); });
    return button;
  }

  function renderActions(): void {
    if (!menu) return;
    menu.replaceChildren(
      actionButton('Copy Element', 'copy-element', ICON_COPY, () => { hide(); callbacks.onCopyElement(); }),
      actionButton('Copy Styles', 'copy-styles', ICON_STYLES, () => { hide(); callbacks.onCopyStyles(); }),
      actionButton('Copy HTML', 'copy-html', ICON_CODE, () => { hide(); callbacks.onCopyHtml(); }),
      actionButton('Add to Review…', 'add-review', ICON_COMMENT, renderReview),
      actionButton('Cancel', 'cancel', null, () => { hide(); callbacks.onCancel(); }),
    );
  }

  function renderReview(): void {
    if (!menu) return;
    const textarea = document.createElement('textarea');
    textarea.maxLength = MAX_COMMENT_LENGTH;
    textarea.setAttribute('aria-label', 'Review comment');
    textarea.placeholder = 'Optional review comment';
    const count = document.createElement('span');
    count.setAttribute('data-point-grab-comment-count', '');
    const add = actionButton('Add to batch', 'add-batch', null, () => { hide(); callbacks.onAddToReview(textarea.value.trim()); });
    const without = actionButton('Add without comment', 'add-without-comment', null, () => { hide(); callbacks.onAddToReview(''); });
    const cancel = actionButton('Cancel', 'cancel-review', null, renderActions);
    const footer = document.createElement('div');
    footer.className = 'point-grab-review-footer';
    footer.append(add, without, cancel, count);
    const updateCount = () => {
      count.textContent = `${textarea.value.length}/${MAX_COMMENT_LENGTH}`;
      add.disabled = textarea.value.length > MAX_COMMENT_LENGTH;
    };
    textarea.addEventListener('input', updateCount);
    menu.replaceChildren(textarea, footer);
    updateCount();
    textarea.focus();
  }

  function ensureMenu(): HTMLDivElement {
    if (menu) return menu;
    injectStyles();
    menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Selected element actions');
    document.body.appendChild(menu);
    return menu;
  }

  return {
    show(anchor): void {
      const element = ensureMenu();
      renderActions();
      if (anchor) {
        const left = Math.max(8, Math.min(window.innerWidth - 236, anchor.x + 12));
        const top = Math.max(8, Math.min(window.innerHeight - 180, anchor.y + 12));
        element.style.left = `${left}px`;
        element.style.top = `${top}px`;
      }
      visible = true;
      element.classList.add('point-grab-menu-visible');
      keydownHandler = (event) => {
        if (event.key === 'Escape') { event.stopImmediatePropagation(); hide(); callbacks.onCancel(); }
      };
      document.addEventListener('keydown', keydownHandler, true);
    },
    hide,
    isVisible: () => visible,
    isMenuElement(el): boolean {
      return !!menu && (el === menu || menu.contains(el));
    },
    dispose(): void {
      hide();
      menu?.remove();
      document.getElementById(STYLE_ID)?.remove();
      menu = null;
    },
  };
}
