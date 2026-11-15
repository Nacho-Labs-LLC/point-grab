interface ParsedKey {
  key: string;
  meta: boolean;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
}

export interface KeyboardHandler {
  start(): void;
  stop(): void;
  dispose(): void;
}

export interface KeyboardHandlerDeps {
  getActivationKey: () => string;
  getActivationMode: () => 'hold' | 'toggle';
  getKeyHoldDuration: () => number;
  getEnableInInputs: () => boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  isActive: () => boolean;
}

interface NavigatorUAData {
  platform: string;
}

export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;
  if (uaData?.platform) return /mac/i.test(uaData.platform);
  return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

const MODIFIER_MAP: Record<string, keyof Omit<ParsedKey, 'key'>> = {
  meta: 'meta',
  cmd: 'meta',
  command: 'meta',
  ctrl: 'ctrl',
  control: 'ctrl',
  shift: 'shift',
  alt: 'alt',
  option: 'alt',
};

const KEY_ALIASES: Record<string, string> = { space: ' ', spacebar: ' ', esc: 'escape', del: 'delete', plus: '+' };

/**
 * Does `e` press `key` (lowercase)? Letters and digits also match by physical key, so
 * combos stay usable where a modifier changes the produced character (Option+G is "©"
 * on macOS, Shift+1 is "!") and on non-Latin keyboard layouts.
 */
export function pressesKey(e: KeyboardEvent, key: string): boolean {
  if (!key) return false;
  if (e.key?.toLowerCase() === key) return true;
  if (/^[a-z]$/.test(key)) return e.code === `Key${key.toUpperCase()}`;
  if (/^[0-9]$/.test(key)) return e.code === `Digit${key}`;
  return false;
}

/** Parse a combo like "Ctrl+Shift+X". `null` when it names no key or more than one. */
export function parseKeyCombo(combo: string): ParsedKey | null {
  // A trailing "++" means the plus key itself ("Ctrl++").
  const parts = combo.replace(/\+\+$/, '+plus').split('+').map((s) => s.trim()).filter(Boolean);
  const result: ParsedKey = {
    key: '',
    meta: false,
    ctrl: false,
    shift: false,
    alt: false,
  };

  for (const part of parts) {
    const lower = part.toLowerCase();
    const modifier = MODIFIER_MAP[lower];
    if (modifier) {
      result[modifier] = true;
    } else if (result.key) {
      return null;
    } else {
      result.key = KEY_ALIASES[lower] ?? lower;
    }
  }

  return result.key ? result : null;
}

const warned = new Set<string>();
function parseOrWarn(combo: string): ParsedKey | null {
  const parsed = parseKeyCombo(combo);
  if (!parsed && !warned.has(combo)) {
    warned.add(combo);
    console.warn(`[point-grab] activationKey "${combo}" is not a valid shortcut. Use one key plus optional modifiers, e.g. "Ctrl+Shift+X".`);
  }
  return parsed;
}

function matchesCombo(e: KeyboardEvent, parsed: ParsedKey): boolean {
  // Modifiers must match exactly, so "Ctrl+B" leaves Ctrl+Shift+B (bookmarks bar) alone.
  // Shift is only enforced for letters and digits: symbols like "?" need it implicitly.
  if (e.metaKey !== parsed.meta || e.ctrlKey !== parsed.ctrl || e.altKey !== parsed.alt) return false;
  if (/^[a-z0-9]$/.test(parsed.key) && e.shiftKey !== parsed.shift) return false;
  return pressesKey(e, parsed.key);
}

function isInputElement(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

export function createKeyboardHandler(deps: KeyboardHandlerDeps): KeyboardHandler {
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let holdActivated = false;
  let listening = false;
  let toggleArmed = false;

  function handleKeyDown(e: KeyboardEvent): void {
    if (!deps.getEnableInInputs() && isInputElement(e.target)) return;

    const parsed = parseOrWarn(deps.getActivationKey());
    if (!parsed || !matchesCombo(e, parsed)) return;

    // A real text selection belongs to the browser's normal copy command.
    if (parsed.key === 'c' && (parsed.ctrl || parsed.meta) && window.getSelection()?.toString()) return;

    const mode = deps.getActivationMode();
    const holdDuration = deps.getKeyHoldDuration();

    if (mode === 'hold') {
      e.preventDefault();

      if (holdActivated) return;

      if (holdDuration > 0) {
        if (holdTimer) return;
        holdTimer = setTimeout(() => {
          holdActivated = true;
          deps.onActivate();
        }, holdDuration);
      } else {
        holdActivated = true;
        deps.onActivate();
      }
    } else {
      // toggle mode
      e.preventDefault();
      toggleArmed = true;
    }
  }

  function handleKeyUp(e: KeyboardEvent): void {
    const parsed = parseKeyCombo(deps.getActivationKey());

    // For key-up we check if the released key matches the main key
    if (!parsed || !pressesKey(e, parsed.key)) return;

    const mode = deps.getActivationMode();

    if (mode === 'hold') {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
      if (holdActivated) {
        holdActivated = false;
        deps.onDeactivate();
      }
    } else {
      // toggle mode: toggle on key-up so we don't double-fire
      if (!toggleArmed) return;
      toggleArmed = false;
      if (deps.isActive()) {
        deps.onDeactivate();
      } else {
        deps.onActivate();
      }
    }
  }

  return {
    start(): void {
      if (listening) return;
      listening = true;
      document.addEventListener('keydown', handleKeyDown, true);
      document.addEventListener('keyup', handleKeyUp, true);
    },

    stop(): void {
      if (!listening) return;
      listening = false;

      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
      holdActivated = false;

      document.removeEventListener('keydown', handleKeyDown, true);
      toggleArmed = false;
      document.removeEventListener('keyup', handleKeyUp, true);
    },

    dispose(): void {
      this.stop();
    },
  };
}
