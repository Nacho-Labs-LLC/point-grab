import { Z_INDEX_OVERLAY, Z_INDEX_LABEL } from '../constants';

const STYLE_ID = '__pointgrab-feedback-styles__';

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes pointgrab-flash {
      0%   { opacity: 1; }
      100% { opacity: 0; transform: scale(1.02); }
    }
    @keyframes pointgrab-pill-in {
      0%   { opacity: 0; transform: translateY(4px) scale(0.9); }
      30%  { opacity: 1; transform: translateY(0) scale(1); }
      70%  { opacity: 1; transform: translateY(0) scale(1); }
      100% { opacity: 0; transform: translateY(-8px) scale(0.95); }
    }
    .pointgrab-select-flash {
      position: fixed;
      pointer-events: none;
      z-index: ${Z_INDEX_OVERLAY};
      border: 2px solid #22c55e;
      background: rgba(34, 197, 94, 0.12);
      border-radius: 3px;
      box-sizing: border-box;
      animation: pointgrab-flash 0.45s ease-out forwards;
    }
    .pointgrab-select-pill {
      position: fixed;
      pointer-events: none;
      z-index: ${Z_INDEX_LABEL};
      display: flex;
      align-items: center;
      gap: 4px;
      background: #22c55e;
      color: #fff;
      font: 600 10px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 3px 8px;
      border-radius: 10px;
      white-space: nowrap;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      box-shadow: 0 2px 8px rgba(34, 197, 94, 0.35);
      animation: pointgrab-pill-in 0.9s ease-out forwards;
    }
    .pointgrab-select-pill svg {
      width: 10px;
      height: 10px;
      flex-shrink: 0;
    }
  `;
  document.head.appendChild(style);
}

const CHECK_SVG = `<svg viewBox="0 0 10 10" fill="none"><path d="M2 5.5l2 2 4-4" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function showSelectFeedback(element: Element): void {
  injectStyles();

  const rect = element.getBoundingClientRect();

  // Green flash overlay on the element
  const flash = document.createElement('div');
  flash.className = 'pointgrab-select-flash';
  flash.style.top = `${rect.top}px`;
  flash.style.left = `${rect.left}px`;
  flash.style.width = `${rect.width}px`;
  flash.style.height = `${rect.height}px`;
  document.body.appendChild(flash);

  // "Copied" pill above the element
  const pill = document.createElement('div');
  pill.className = 'pointgrab-select-pill';
  pill.innerHTML = `${CHECK_SVG} Copied`;
  document.body.appendChild(pill);

  // Position pill centered above the element (or below if no room)
  const pillWidth = 70; // approximate
  let pillLeft = rect.left + rect.width / 2 - pillWidth / 2;
  let pillTop = rect.top - 24;
  if (pillTop < 4) {
    pillTop = rect.bottom + 6;
  }
  // Clamp to viewport
  const vw = document.documentElement.clientWidth;
  if (pillLeft + pillWidth > vw - 4) pillLeft = vw - pillWidth - 4;
  if (pillLeft < 4) pillLeft = 4;

  pill.style.top = `${pillTop}px`;
  pill.style.left = `${pillLeft}px`;

  // Clean up after animations complete
  const cleanup = () => {
    flash.remove();
    pill.remove();
  };
  pill.addEventListener('animationend', cleanup);

  // Safety fallback
  setTimeout(cleanup, 1200);
}

export function disposeFeedbackStyles(): void {
  document.getElementById(STYLE_ID)?.remove();
}
