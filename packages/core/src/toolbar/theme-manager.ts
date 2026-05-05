import type { ThemeMode, Theme } from '../types';

const STYLE_ID = '__point-grab-theme-vars__';
const OVERRIDE_STYLE_ID = '__point-grab-theme-overrides__';

const DARK_VARS = `
  :root {
    --point-grab-bg: #0f172a;
    --point-grab-text: #e2e8f0;
    --point-grab-text-muted: #64748b;
    --point-grab-accent: #3b82f6;
    --point-grab-accent-hover: #2563eb;
    --point-grab-surface: #1e293b;
    --point-grab-border: #334155;
    --point-grab-overlay-border: #3b82f6;
    --point-grab-overlay-bg: rgba(59, 130, 246, 0.1);
    --point-grab-label-bg: #3b82f6;
    --point-grab-label-text: #fff;
    --point-grab-toast-bg: #0f172a;
    --point-grab-toast-text: #e2e8f0;
    --point-grab-toast-title: #fff;
    --point-grab-toast-label: #64748b;
    --point-grab-toast-shadow: rgba(0, 0, 0, 0.4);
    --point-grab-toolbar-bg: #0f172a;
    --point-grab-toolbar-text: #94a3b8;
    --point-grab-toolbar-hover: #1e293b;
    --point-grab-toolbar-active: #3b82f6;
    --point-grab-toolbar-border: #1e293b;
    --point-grab-toolbar-shadow: rgba(0, 0, 0, 0.5);
    --point-grab-popover-bg: #0f172a;
    --point-grab-popover-text: #e2e8f0;
    --point-grab-popover-border: #1e293b;
    --point-grab-popover-hover: #1e293b;
    --point-grab-popover-shadow: rgba(0, 0, 0, 0.5);
  }
`;

const LIGHT_VARS = `
  :root {
    --point-grab-bg: #ffffff;
    --point-grab-text: #334155;
    --point-grab-text-muted: #94a3b8;
    --point-grab-accent: #2563eb;
    --point-grab-accent-hover: #1d4ed8;
    --point-grab-surface: #f1f5f9;
    --point-grab-border: #e2e8f0;
    --point-grab-overlay-border: #2563eb;
    --point-grab-overlay-bg: rgba(37, 99, 235, 0.08);
    --point-grab-label-bg: #2563eb;
    --point-grab-label-text: #fff;
    --point-grab-toast-bg: #ffffff;
    --point-grab-toast-text: #334155;
    --point-grab-toast-title: #0f172a;
    --point-grab-toast-label: #94a3b8;
    --point-grab-toast-shadow: rgba(0, 0, 0, 0.12);
    --point-grab-toolbar-bg: #ffffff;
    --point-grab-toolbar-text: #64748b;
    --point-grab-toolbar-hover: #f1f5f9;
    --point-grab-toolbar-active: #2563eb;
    --point-grab-toolbar-border: #e2e8f0;
    --point-grab-toolbar-shadow: rgba(0, 0, 0, 0.12);
    --point-grab-popover-bg: #ffffff;
    --point-grab-popover-text: #334155;
    --point-grab-popover-border: #e2e8f0;
    --point-grab-popover-hover: #f1f5f9;
    --point-grab-popover-shadow: rgba(0, 0, 0, 0.12);
  }
`;

/** Maps Theme interface fields to CSS variable names. */
const THEME_TO_VAR: Record<keyof Theme, string> = {
  overlayBorderColor: '--point-grab-overlay-border',
  overlayBgColor: '--point-grab-overlay-bg',
  labelBgColor: '--point-grab-label-bg',
  labelTextColor: '--point-grab-label-text',
  toastBgColor: '--point-grab-toast-bg',
  toastTextColor: '--point-grab-toast-text',
  toolbarBgColor: '--point-grab-toolbar-bg',
  toolbarTextColor: '--point-grab-toolbar-text',
  toolbarAccentColor: '--point-grab-toolbar-active',
  popoverBgColor: '--point-grab-popover-bg',
  popoverTextColor: '--point-grab-popover-text',
  popoverBorderColor: '--point-grab-popover-border',
};

export interface ThemeManager {
  apply(mode: ThemeMode): void;
  applyOverrides(theme: Partial<Theme>): void;
  clearOverrides(): void;
  dispose(): void;
}

export function createThemeManager(): ThemeManager {
  let styleEl: HTMLStyleElement | null = null;
  let overrideEl: HTMLStyleElement | null = null;
  let currentMode: ThemeMode = 'dark';
  let mediaQuery: MediaQueryList | null = null;
  let mediaHandler: ((e: MediaQueryListEvent) => void) | null = null;

  function getOrCreateStyle(): HTMLStyleElement {
    if (styleEl) return styleEl;

    const existing = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (existing) {
      styleEl = existing;
      return styleEl;
    }

    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    document.head.appendChild(styleEl);
    return styleEl;
  }

  function getOrCreateOverrideStyle(): HTMLStyleElement {
    if (overrideEl) return overrideEl;

    overrideEl = document.createElement('style');
    overrideEl.id = OVERRIDE_STYLE_ID;
    document.head.appendChild(overrideEl);
    return overrideEl;
  }

  function resolveMode(mode: ThemeMode): 'dark' | 'light' {
    if (mode !== 'system') return mode;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyResolved(resolved: 'dark' | 'light'): void {
    const el = getOrCreateStyle();
    el.textContent = resolved === 'dark' ? DARK_VARS : LIGHT_VARS;
  }

  function detachMediaListener(): void {
    if (mediaQuery && mediaHandler) {
      mediaQuery.removeEventListener('change', mediaHandler);
    }
    mediaQuery = null;
    mediaHandler = null;
  }

  return {
    apply(mode: ThemeMode): void {
      currentMode = mode;
      detachMediaListener();

      applyResolved(resolveMode(mode));

      if (mode === 'system') {
        mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaHandler = () => applyResolved(resolveMode('system'));
        mediaQuery.addEventListener('change', mediaHandler);
      }
    },

    applyOverrides(theme: Partial<Theme>): void {
      const vars: string[] = [];
      for (const [key, varName] of Object.entries(THEME_TO_VAR)) {
        const value = theme[key as keyof Theme];
        if (value) {
          vars.push(`    ${varName}: ${value};`);
        }
      }

      if (vars.length === 0) {
        this.clearOverrides();
        return;
      }

      const el = getOrCreateOverrideStyle();
      el.textContent = `  :root {\n${vars.join('\n')}\n  }`;
    },

    clearOverrides(): void {
      overrideEl?.remove();
      document.getElementById(OVERRIDE_STYLE_ID)?.remove();
      overrideEl = null;
    },

    dispose(): void {
      detachMediaListener();
      styleEl?.remove();
      document.getElementById(STYLE_ID)?.remove();
      styleEl = null;
      this.clearOverrides();
    },
  };
}
