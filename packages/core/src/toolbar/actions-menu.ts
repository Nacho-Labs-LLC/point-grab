import { ICON_COPY, ICON_STYLES, ICON_CODE, ICON_COMMENT, ICON_TRASH } from './toolbar-icons';
import { Z_INDEX_POPOVER, TOOLBAR_POPOVER_OFFSET } from '../constants';

const MENU_ID = '__point-grab-actions-menu__';
const STYLE_ID = '__point-grab-actions-styles__';

export interface ActionsMenuCallbacks {
  onCopyElement: () => void;
  onCopyStyles: () => void;
  onCopyHtml: () => void;
  onComment: () => void;
  onClearHistory: () => void;
}

export interface ActionsMenu {
  show(): void;
  hide(): void;
  isVisible(): boolean;
  isMenuElement(el: Element): boolean;
  dispose(): void;
}

interface MenuItem {
  icon: string;
  label: string;
  action: () => void;
  separator?: false;
}

interface MenuSeparator {
  separator: true;
}

type MenuEntry = MenuItem | MenuSeparator;

export function createActionsMenu(callbacks: ActionsMenuCallbacks): ActionsMenu {
  let menu: HTMLDivElement | null = null;
  let visible = false;

  const items: MenuEntry[] = [
    { icon: ICON_COPY, label: 'Copy Element', action: callbacks.onCopyElement },
    { icon: ICON_STYLES, label: 'Copy Styles', action: callbacks.onCopyStyles },
    { icon: ICON_CODE, label: 'Copy HTML', action: callbacks.onCopyHtml },
    { icon: ICON_COMMENT, label: 'Comment', action: callbacks.onComment },
    { separator: true },
    { icon: ICON_TRASH, label: 'Clear History', action: callbacks.onClearHistory },
  ];

  function injectStyles(): void {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${MENU_ID} {
        position: fixed;
        bottom: ${TOOLBAR_POPOVER_OFFSET};
        left: 50%;
        transform: translateX(-50%);
        z-index: ${Z_INDEX_POPOVER};
        background: var(--point-grab-popover-bg, #0f172a);
        border: 1px solid var(--point-grab-popover-border, #1e293b);
        border-radius: 10px;
        box-shadow: 0 8px 24px var(--point-grab-popover-shadow, rgba(0, 0, 0, 0.5));
        min-width: 200px;
        padding: 4px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.15s ease, visibility 0.15s ease;
        pointer-events: auto;
      }
      #${MENU_ID}.point-grab-menu-visible {
        opacity: 1;
        visibility: visible;
      }
      #${MENU_ID} .point-grab-menu-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--point-grab-popover-text, #e2e8f0);
        font-size: 13px;
        cursor: pointer;
        width: 100%;
        text-align: left;
        transition: background 0.1s ease;
      }
      #${MENU_ID} .point-grab-menu-item:hover {
        background: var(--point-grab-popover-hover, #1e293b);
      }
      #${MENU_ID} .point-grab-menu-item svg {
        flex-shrink: 0;
        opacity: 0.7;
      }
      #${MENU_ID} .point-grab-menu-sep {
        height: 1px;
        background: var(--point-grab-popover-border, #1e293b);
        margin: 4px 8px;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureMenu(): HTMLDivElement {
    if (menu) return menu;

    injectStyles();
    menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Actions');

    for (const entry of items) {
      if (entry.separator) {
        const sep = document.createElement('div');
        sep.className = 'point-grab-menu-sep';
        menu.appendChild(sep);
        continue;
      }

      const btn = document.createElement('button');
      btn.className = 'point-grab-menu-item';
      btn.setAttribute('role', 'menuitem');

      const iconContainer = document.createElement('span');
      iconContainer.innerHTML = entry.icon;
      if (iconContainer.firstElementChild) {
        btn.appendChild(iconContainer.firstElementChild);
      }

      const labelSpan = document.createElement('span');
      labelSpan.textContent = entry.label;
      btn.appendChild(labelSpan);

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        visible = false;
        menu?.classList.remove('point-grab-menu-visible');
        entry.action();
      });
      menu.appendChild(btn);
    }

    document.body.appendChild(menu);
    return menu;
  }

  return {
    show(): void {
      const el = ensureMenu();
      visible = true;
      void el.offsetHeight;
      el.classList.add('point-grab-menu-visible');
    },

    hide(): void {
      visible = false;
      menu?.classList.remove('point-grab-menu-visible');
    },

    isVisible(): boolean {
      return visible;
    },

    isMenuElement(el: Element): boolean {
      if (!menu) return false;
      let current: Element | null = el;
      while (current) {
        if (current === menu || current.id === MENU_ID) return true;
        current = current.parentElement;
      }
      return false;
    },

    dispose(): void {
      menu?.remove();
      document.getElementById(STYLE_ID)?.remove();
      menu = null;
      visible = false;
    },
  };
}
