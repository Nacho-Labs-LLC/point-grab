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

function parseKeyCombo(combo: string): ParsedKey {
  const parts = combo.split('+').map((s) => s.trim());
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
    } else {
      result.key = lower;
    }
  }

  return result;
}

function matchesCombo(e: KeyboardEvent, parsed: ParsedKey): boolean {
  if (parsed.meta !== e.metaKey) return false;
  if (parsed.ctrl !== e.ctrlKey) return false;
  if (parsed.shift !== e.shiftKey) return false;
  if (parsed.alt !== e.altKey) return false;

  return e.key.toLowerCase() === parsed.key;
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

  function handleKeyDown(e: KeyboardEvent): void {
    if (!deps.getEnableInInputs() && isInputElement(e.target)) return;

    const parsed = parseKeyCombo(deps.getActivationKey());
    if (!matchesCombo(e, parsed)) return;

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
    }
  }

  function handleKeyUp(e: KeyboardEvent): void {
    const parsed = parseKeyCombo(deps.getActivationKey());

    // Toggle only when the released key still satisfies the configured combo.
    if (!matchesCombo(e, parsed)) return;

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
      document.removeEventListener('keyup', handleKeyUp, true);
    },

    dispose(): void {
      this.stop();
    },
  };
}
