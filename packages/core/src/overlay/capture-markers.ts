import { Z_INDEX_LABEL } from '../constants';

const STYLE_ID = '__point-grab-capture-marker-styles__';

export interface CaptureMarkers {
  add(x: number, y: number, number: number, onHover?: () => void): void;
  clear(): void;
  isMarkerElement(el: Element): boolean;
  dispose(): void;
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    [data-point-grab-marker] {
      position: fixed;
      z-index: ${Z_INDEX_LABEL};
      width: 22px;
      height: 22px;
      display: grid;
      place-items: center;
      border: 2px solid #fff;
      border-radius: 999px;
      background: var(--point-grab-accent, #3b82f6);
      color: #fff;
      font: 700 11px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 2px 10px rgba(15, 23, 42, .45);
      transform: translate(-50%, -50%);
      cursor: pointer;
    }
    [data-point-grab-marker]:hover { transform: translate(-50%, -50%) scale(1.15); }
  `;
  document.head.appendChild(style);
}

export function createCaptureMarkers(): CaptureMarkers {
  const markers: HTMLElement[] = [];

  return {
    add(x: number, y: number, number: number, onHover?: () => void): void {
      injectStyles();
      const marker = document.createElement('button');
      marker.type = 'button';
      marker.dataset.pointGrabMarker = String(number);
      marker.setAttribute('aria-label', `Review captured element ${number}`);
      marker.textContent = String(number);
      marker.style.left = `${Math.max(12, Math.min(window.innerWidth - 12, x))}px`;
      marker.style.top = `${Math.max(12, Math.min(window.innerHeight - 12, y))}px`;
      if (onHover) marker.addEventListener('mouseenter', onHover);
      document.body.appendChild(marker);
      markers.push(marker);
    },
    clear(): void {
      markers.splice(0).forEach((marker) => marker.remove());
    },
    isMarkerElement(el: Element): boolean {
      return !!el.closest('[data-point-grab-marker]');
    },
    dispose(): void {
      this.clear();
      document.getElementById(STYLE_ID)?.remove();
    },
  };
}
