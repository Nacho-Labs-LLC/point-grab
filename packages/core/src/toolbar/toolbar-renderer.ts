import type { PointGrabState } from '../store';
import { Z_INDEX_TOOLBAR } from '../constants';
import { ICON_GRAB, ICON_HISTORY, ICON_FREEZE, ICON_SUN, ICON_MOON, ICON_SYSTEM, ICON_POWER, ICON_DISMISS, ICON_COPY } from './toolbar-icons';

const TOOLBAR_ID = '__point-grab-toolbar__';
const STYLE_ID = '__point-grab-toolbar-styles__';

export interface ToolbarCallbacks {
  onSelectionMode: () => void;
  onHistory: () => void;

  onFreeze: () => void;
  onThemeToggle: () => void;
  onEnableToggle: () => void;
  onDismiss: () => void;
  onCopyPrompt?: () => void;
}

export interface ToolbarRenderer {
  show(): void;
  hide(): void;
  update(state: PointGrabState, annotationCount?: number, captureModeActive?: boolean): void;
  isToolbarElement(el: Element): boolean;
  dispose(): void;
}

export function createToolbarRenderer(callbacks: ToolbarCallbacks): ToolbarRenderer {
  let container: HTMLDivElement | null = null;
  let leftGroup: HTMLDivElement | null = null;
  let buttons: Record<string, HTMLButtonElement> = {};
  let allElements = new Set<Element>();

  function injectStyles(): void {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${TOOLBAR_ID} {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: ${Z_INDEX_TOOLBAR};
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 4px 6px;
        background: var(--point-grab-toolbar-bg, #0f172a);
        border: 1px solid var(--point-grab-toolbar-border, #1e293b);
        border-radius: 24px;
        box-shadow: 0 4px 16px var(--point-grab-toolbar-shadow, rgba(0, 0, 0, 0.5));
        pointer-events: auto;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        transition: opacity 0.2s ease, transform 0.2s ease;
      }
      #${TOOLBAR_ID}.point-grab-toolbar-hidden {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
        pointer-events: none;
      }
      #${TOOLBAR_ID} button {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: var(--point-grab-toolbar-text, #94a3b8);
        cursor: pointer;
        padding: 0;
        transition: background 0.15s ease, color 0.15s ease;
      }
      #${TOOLBAR_ID} button:hover {
        background: var(--point-grab-toolbar-hover, #1e293b);
        color: var(--point-grab-accent, #3b82f6);
      }
      [data-point-grab-btn="captureHint"] {
        position: fixed;
        bottom: 72px;
        left: 50%;
        z-index: ${Z_INDEX_TOOLBAR};
        transform: translateX(-50%);
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 11px;
        border: 1px solid var(--point-grab-toolbar-border, #1e293b);
        border-radius: 999px;
        background: color-mix(in srgb, var(--point-grab-toolbar-bg, #0f172a) 82%, transparent);
        color: var(--point-grab-toolbar-text, #94a3b8);
        font: 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        opacity: .72;
        cursor: pointer;
      }
      [data-point-grab-btn="captureHint"]:hover { opacity: 1; color: var(--point-grab-accent, #3b82f6); }
      #${TOOLBAR_ID} button.point-grab-btn-active {
        color: var(--point-grab-toolbar-active, #3b82f6);
      }
      #${TOOLBAR_ID} button.point-grab-copy-prompt-btn {
        width: auto;
        min-width: 32px;
        padding: 0 12px;
        gap: 8px;
        border-radius: 999px;
        background: var(--point-grab-accent, #3b82f6);
        color: #fff;
      }
      #${TOOLBAR_ID} button.point-grab-copy-prompt-btn:hover {
        background: var(--point-grab-accent-hover, #2563eb);
        color: #fff;
      }
      #${TOOLBAR_ID} .point-grab-copy-prompt-label {
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
      }
      #${TOOLBAR_ID} button.point-grab-btn-disabled {
        opacity: 0.4;
        color: var(--point-grab-toolbar-text, #94a3b8);
      }
      #${TOOLBAR_ID} .point-grab-toolbar-divider {
        width: 1px;
        height: 20px;
        background: var(--point-grab-toolbar-border, #1e293b);
        margin: 0 4px;
        flex-shrink: 0;
      }
      #${TOOLBAR_ID} .point-grab-toolbar-left {
        display: flex;
        align-items: center;
        gap: 2px;
        overflow: hidden;
        max-width: 240px;
        opacity: 1;
        transition: max-width 0.25s ease, opacity 0.2s ease, margin 0.25s ease;
      }
      #${TOOLBAR_ID} .point-grab-toolbar-left.point-grab-toolbar-left-hidden {
        max-width: 0;
        opacity: 0;
        pointer-events: none;
      }
      #${TOOLBAR_ID} .point-grab-badge {
        position: absolute;
        top: -2px;
        right: -2px;
        min-width: 14px;
        height: 14px;
        padding: 0 3px;
        border-radius: 7px;
        background: #ef4444;
        color: #fff;
        font-size: 9px;
        font-weight: 700;
        line-height: 14px;
        text-align: center;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  function createButton(name: string, icon: string, title: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.innerHTML = icon;
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.setAttribute('data-point-grab-btn', name);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  function ensureContainer(): void {
    if (container) return;

    injectStyles();

    container = document.createElement('div');
    container.id = TOOLBAR_ID;
    container.setAttribute('role', 'toolbar');
    container.setAttribute('aria-label', 'PointGrab toolbar');

    buttons.selection = createButton('selection', ICON_GRAB, 'Selection mode', callbacks.onSelectionMode);
    buttons.history = createButton('history', ICON_HISTORY, 'History', callbacks.onHistory);

    buttons.freeze = createButton('freeze', ICON_FREEZE, 'Freeze page (F)', callbacks.onFreeze);
    buttons.theme = createButton('theme', ICON_SUN, 'Toggle theme', callbacks.onThemeToggle);
    buttons.enable = createButton('enable', ICON_POWER, 'Enable/Disable', callbacks.onEnableToggle);
    buttons.dismiss = createButton('dismiss', ICON_DISMISS, 'Dismiss toolbar', callbacks.onDismiss);
    buttons.captureHint = createButton('captureHint', ICON_GRAB, 'Start Capture Mode', callbacks.onSelectionMode);
    buttons.captureHint.append(' Capture mode');

    buttons.copyPrompt = createButton('copyPrompt', ICON_COPY, 'Confirm & Copy reviewed elements', () => callbacks.onCopyPrompt?.());
    buttons.copyPrompt.classList.add('point-grab-copy-prompt-btn');
    const copyPromptLabel = document.createElement('span');
    copyPromptLabel.className = 'point-grab-copy-prompt-label';
    copyPromptLabel.textContent = 'Confirm & Copy';
    buttons.copyPrompt.appendChild(copyPromptLabel);
    buttons.copyPrompt.style.display = 'none';

    const divider = document.createElement('span');
    divider.className = 'point-grab-toolbar-divider';

    leftGroup = document.createElement('div');
    leftGroup.className = 'point-grab-toolbar-left';
    leftGroup.appendChild(buttons.selection);
    leftGroup.appendChild(buttons.history);

    leftGroup.appendChild(buttons.copyPrompt);
    leftGroup.appendChild(buttons.freeze);
    leftGroup.appendChild(divider);
    container.appendChild(leftGroup);
    container.appendChild(buttons.theme);
    container.appendChild(buttons.enable);
    container.appendChild(buttons.dismiss);

    document.body.appendChild(container);
    document.body.appendChild(buttons.captureHint);

    // Track all elements
    allElements.clear();
    allElements.add(container);
    allElements.add(leftGroup);
    allElements.add(divider);
    for (const btn of Object.values(buttons)) {
      allElements.add(btn);
    }
  }

  return {
    show(): void {
      ensureContainer();
      container!.classList.remove('point-grab-toolbar-hidden');
    },

    hide(): void {
      if (container) {
        container.classList.add('point-grab-toolbar-hidden');
      }
    },

    update(state: PointGrabState, annotationCount?: number, captureModeActive = false): void {
      if (!container) return;

      // End Capture Mode is the persistent session control. The count is
      // supporting context, not the condition for showing the action.
      if (buttons.copyPrompt) {
        const label = buttons.copyPrompt.querySelector('.point-grab-copy-prompt-label') as HTMLElement | null;
        if (captureModeActive) {
          buttons.copyPrompt.style.display = '';
          const countLabel = `${annotationCount ?? 0}/${state.options.maxCaptureCount}`;
          if (label) label.textContent = `End & Copy Batch (${countLabel})`;
          buttons.copyPrompt.title = `End & Copy Batch (${countLabel})`;
          buttons.copyPrompt.setAttribute('aria-label', buttons.copyPrompt.title);

          let badge = buttons.copyPrompt.querySelector('.point-grab-badge') as HTMLElement | null;
          badge?.remove();
        } else {
          buttons.copyPrompt.style.display = 'none';
          if (label) label.textContent = 'Confirm & Copy';
          buttons.copyPrompt.querySelector('.point-grab-badge')?.remove();
        }
      }

      if (buttons.captureHint) {
        buttons.captureHint.style.display = '';
        buttons.captureHint.lastChild!.textContent = captureModeActive
          ? ' Esc cancel · F freeze · Click for actions'
          : ' Capture mode';
      }

      // Selection mode active state
      if (state.active) {
        buttons.selection.classList.add('point-grab-btn-active');
      } else {
        buttons.selection.classList.remove('point-grab-btn-active');
      }

      // Theme icon
      const mode = state.toolbar.themeMode;
      const themeIcon = mode === 'dark' ? ICON_SUN : mode === 'light' ? ICON_MOON : ICON_SYSTEM;
      const themeLabel = mode === 'dark' ? 'Switch to light mode' : mode === 'light' ? 'Switch to system theme' : 'Switch to dark mode';
      buttons.theme.innerHTML = themeIcon;
      buttons.theme.title = themeLabel;
      buttons.theme.setAttribute('aria-label', themeLabel);

      // Freeze button active state
      if (state.frozen) {
        buttons.freeze.classList.add('point-grab-btn-active');
      } else {
        buttons.freeze.classList.remove('point-grab-btn-active');
      }

      // Enable/disable — hide/show left side
      if (state.options.enabled) {
        buttons.enable.classList.add('point-grab-btn-active');
        leftGroup?.classList.remove('point-grab-toolbar-left-hidden');
      } else {
        buttons.enable.classList.remove('point-grab-btn-active');
        leftGroup?.classList.add('point-grab-toolbar-left-hidden');
      }
    },

    isToolbarElement(el: Element): boolean {
      if (allElements.has(el)) return true;

      // Walk up to check if el is inside the toolbar (e.g. SVG children)
      let current: Element | null = el;
      while (current) {
        if (current === container) return true;
        if (current.id === TOOLBAR_ID) return true;
        current = current.parentElement;
      }
      return false;
    },

    dispose(): void {
      buttons.captureHint?.remove();
      container?.remove();
      document.getElementById(STYLE_ID)?.remove();
      container = null;
      leftGroup = null;
      buttons = {};
      allElements.clear();
    },
  };
}
