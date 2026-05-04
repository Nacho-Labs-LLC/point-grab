import { Z_INDEX_CROSSHAIR } from '../constants';

const CROSSHAIR_STYLE_ID = '__pointgrab-crosshair-styles__';
const H_LINE_ID = '__pointgrab-crosshair-h__';
const V_LINE_ID = '__pointgrab-crosshair-v__';

export interface Crosshair {
  activate(): void;
  deactivate(): void;
  isCrosshairElement(el: Element): boolean;
  dispose(): void;
}

export function createCrosshair(): Crosshair {
  let hLine: HTMLDivElement | null = null;
  let vLine: HTMLDivElement | null = null;
  let listening = false;

  function injectStyles(): void {
    if (document.getElementById(CROSSHAIR_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = CROSSHAIR_STYLE_ID;
    style.textContent = `
      .point-grab-crosshair-line {
        position: fixed;
        pointer-events: none;
        z-index: ${Z_INDEX_CROSSHAIR};
        background: var(--point-grab-accent, #3b82f6);
        opacity: 0.25;
        transition: none;
      }
      #${H_LINE_ID} {
        left: 0;
        right: 0;
        height: 1px;
      }
      #${V_LINE_ID} {
        top: 0;
        bottom: 0;
        width: 1px;
      }
      body.point-grab-crosshair-active {
        cursor: crosshair !important;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureElements(): void {
    if (!hLine) {
      injectStyles();
      hLine = document.createElement('div');
      hLine.id = H_LINE_ID;
      hLine.className = 'point-grab-crosshair-line';
      document.body.appendChild(hLine);
    }
    if (!vLine) {
      vLine = document.createElement('div');
      vLine.id = V_LINE_ID;
      vLine.className = 'point-grab-crosshair-line';
      document.body.appendChild(vLine);
    }
  }

  function handleMouseMove(e: MouseEvent): void {
    if (hLine) {
      hLine.style.top = `${e.clientY}px`;
    }
    if (vLine) {
      vLine.style.left = `${e.clientX}px`;
    }
  }

  return {
    activate(): void {
      if (listening) return;
      listening = true;
      ensureElements();
      document.body.classList.add('point-grab-crosshair-active');
      document.addEventListener('mousemove', handleMouseMove, true);
    },

    deactivate(): void {
      if (!listening) return;
      listening = false;
      document.body.classList.remove('point-grab-crosshair-active');
      document.removeEventListener('mousemove', handleMouseMove, true);
      if (hLine) hLine.style.top = '-10px';
      if (vLine) vLine.style.left = '-10px';
    },

    isCrosshairElement(el: Element): boolean {
      return el === hLine || el === vLine
        || el.id === H_LINE_ID || el.id === V_LINE_ID;
    },

    dispose(): void {
      this.deactivate();
      hLine?.remove();
      vLine?.remove();
      document.getElementById(CROSSHAIR_STYLE_ID)?.remove();
      hLine = null;
      vLine = null;
    },
  };
}
