import type { ThemeMode, Theme } from '../types';

const STYLE_ID = '__pointgrab-theme-vars__';
const OVERRIDE_STYLE_ID = '__pointgrab-theme-overrides__';

const DARK_VARS = `
  :root {
    --pointgrab-bg: #0f172a;
    --pointgrab-text: #e2e8f0;
    --pointgrab-text-muted: #64748b;
    --pointgrab-accent: #3b82f6;
    --pointgrab-accent-hover: #2563eb;
    --pointgrab-surface: #1e293b;
    --pointgrab-border: #334155;
    --pointgrab-overlay-border: #3b82f6;
    --pointgrab-overlay-bg: rgba(59, 130, 246, 0.1);
    --pointgrab-label-bg: #3b82f6;
    --pointgrab-label-text: #fff;
    --pointgrab-toast-bg: #0f172a;
    --pointgrab-toast-text: #e2e8f0;
    --pointgrab-toast-title: #fff;
    --pointgrab-toast-label: #64748b;
    --pointgrab-toast-shadow: rgba(0, 0, 0, 0.4);
    --pointgrab-toolbar-bg: #0f172a;
    --pointgrab-toolbar-text: #94a3b8;
    --pointgrab-toolbar-hover: #1e293b;
    --pointgrab-toolbar-active: #3b82f6;
    --pointgrab-toolbar-border: #1e293b;
    --pointgrab-toolbar-shadow: rgba(0, 0, 0, 0.5);
    --pointgrab-popover-bg: #0f172a;
    --pointgrab-popover-text: #e2e8f0;
    --pointgrab-popover-border: #1e293b;
    --pointgrab-popover-hover: #1e293b;
    --pointgrab-popover-shadow: rgba(0, 0, 0, 0.5);
  }
`;

const LIGHT_VARS = `
  :root {
    --pointgrab-bg: #ffffff;
    --pointgrab-text: #334155;
    --pointgrab-text-muted: #94a3b8;
    --pointgrab-accent: #2563eb;
    --pointgrab-accent-hover: #1d4ed8;
    --pointgrab-surface: #f1f5f9;
    --pointgrab-border: #e2e8f0;
    --pointgrab-overlay-border: #2563eb;
    --pointgrab-overlay-bg: rgba(37, 99, 235, 0.08);
    --pointgrab-label-bg: #2563eb;
    --pointgrab-label-text: #fff;
    --pointgrab-toast-bg: #ffffff;
    --pointgrab-toast-text: #334155;
    --pointgrab-toast-title: #0f172a;
    --pointgrab-toast-label: #94a3b8;
    --pointgrab-toast-shadow: rgba(0, 0, 0, 0.12);
    --pointgrab-toolbar-bg: #ffffff;
    --pointgrab-toolbar-text: #64748b;
    --pointgrab-toolbar-hover: #f1f5f9;
    --pointgrab-toolbar-active: #2563eb;
    --pointgrab-toolbar-border: #e2e8f0;
    --pointgrab-toolbar-shadow: rgba(0, 0, 0, 0.12);
    --pointgrab-popover-bg: #ffffff;
    --pointgrab-popover-text: #334155;
    --pointgrab-popover-border: #e2e8f0;
    --pointgrab-popover-hover: #f1f5f9;
    --pointgrab-popover-shadow: rgba(0, 0, 0, 0.12);
  }
`;

/** Maps Theme interface fields to CSS variable names. */
const THEME_TO_VAR: Record<keyof Theme, string> = {
  overlayBorderColor: '--pointgrab-overlay-border',
  overlayBgColor: '--pointgrab-overlay-bg',
  labelBgColor: '--pointgrab-label-bg',
  labelTextColor: '--pointgrab-label-text',
  toastBgColor: '--pointgrab-toast-bg',
  toastTextColor: '--pointgrab-toast-text',
  toolbarBgColor: '--pointgrab-toolbar-bg',
  toolbarTextColor: '--pointgrab-toolbar-text',
  toolbarAccentColor: '--pointgrab-toolbar-active',
  popoverBgColor: '--pointgrab-popover-bg',
  popoverTextColor: '--pointgrab-popover-text',
  popoverBorderColor: '--pointgrab-popover-border',
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
