import type { ScreenGrab } from './types';
import { capturePageRegion, type PageRegion } from './page-capture';

const ID = '__point-grab-screen-grab__';
const STYLE_ID = '__point-grab-screen-grab-styles__';
const MAX_PNG_BYTES = 2 * 1024 * 1024;

/** Select directly on the live page; preview is mandatory before explicit acknowledged Send. */
export function createScreenGrab(callbacks: {
  onSubmit: (grab: ScreenGrab) => Promise<void>;
  onBusy: (busy: boolean) => void;
}) {
  let root: HTMLDivElement | null = null;
  let generation = 0;
  let returnFocus: HTMLElement | null = null;
  let sending = false;
  let cleanup = () => {};

  function close(): void {
    generation++;
    cleanup(); cleanup = () => {};
    root?.remove(); root = null;
    callbacks.onBusy(false);
    returnFocus?.focus({ preventScroll: true });
  }

  function injectStyles(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style'); style.id = STYLE_ID;
    style.textContent = `
      #${ID}{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;color:#e2e8f0;font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
      #${ID} *{box-sizing:border-box}
      #${ID}.pg-sg-review{background:rgba(2,6,23,.72);padding:16px}
      #${ID}.pg-sg-select{background:transparent;cursor:crosshair;touch-action:none;user-select:none}
      #${ID} .pg-sg-bar{position:absolute;top:16px;left:50%;transform:translateX(-50%);max-width:calc(100vw - 32px);display:flex;align-items:center;gap:12px;padding:8px 8px 8px 16px;background:#0f172a;border:1px solid #334155;border-radius:999px;box-shadow:0 10px 30px rgba(0,0,0,.35);cursor:default;pointer-events:none;white-space:nowrap}
      #${ID} .pg-sg-bar [role=status],#${ID} .pg-sg-bar [role=alert]{color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:normal}
      #${ID} .pg-sg-bar [role=alert]{color:#fca5a5}
      #${ID} .pg-sg-rect{position:absolute;border:2px solid #38bdf8;background:rgba(56,189,248,.08);box-shadow:0 0 0 100vmax rgba(2,6,23,.45);pointer-events:none;border-radius:2px}
      #${ID} .pg-sg-size{position:absolute;right:-2px;top:calc(100% + 6px);padding:2px 8px;border-radius:6px;background:#0f172a;color:#e2e8f0;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap}
      #${ID} .pg-sg-card{width:min(600px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#0f172a;border:1px solid #334155;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.5);padding:20px}
      #${ID} .pg-sg-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 14px}
      #${ID} h2{margin:0;font-size:16px;font-weight:600;color:#f8fafc}
      #${ID} .pg-sg-chip{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:#94a3b8;background:#1e293b;border-radius:6px;padding:2px 8px}
      #${ID} .pg-sg-image{display:flex;justify-content:center;padding:10px;border:1px solid #1e293b;border-radius:10px;background:repeating-conic-gradient(#1e293b 0 25%,#0f172a 0 50%) 0 0/16px 16px}
      #${ID} .pg-sg-image img{display:block;max-width:100%;max-height:42vh;object-fit:contain;border-radius:4px}
      #${ID} .pg-sg-note{margin:10px 0 0;font-size:12.5px;color:#94a3b8}
      #${ID} .pg-sg-note.pg-sg-warn{color:#fcd34d}
      #${ID} label{display:block;margin:16px 0 6px;font-size:13px;font-weight:500;color:#cbd5e1}
      #${ID} textarea{display:block;width:100%;min-height:84px;resize:vertical;padding:10px 12px;border:1px solid #334155;border-radius:10px;background:#020617;color:#f8fafc;font:inherit;outline:none}
      #${ID} textarea:focus{border-color:#38bdf8;box-shadow:0 0 0 3px rgba(56,189,248,.25)}
      #${ID} .pg-sg-card [role=status]{min-height:1.5em;margin:8px 0 0;font-size:13px;color:#fca5a5}
      #${ID} .pg-sg-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px}
      #${ID} .pg-sg-spacer{flex:1}
      #${ID} button{pointer-events:auto;padding:8px 14px;border:1px solid #334155;border-radius:8px;background:#1e293b;color:#f1f5f9;font:500 13px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer}
      #${ID} button:hover:not(:disabled){background:#273449}
      #${ID} button:focus-visible{outline:2px solid #38bdf8;outline-offset:2px}
      #${ID} button:disabled{opacity:.5;cursor:not-allowed}
      #${ID} button.pg-sg-primary{background:#2563eb;border-color:#2563eb;color:#fff}
      #${ID} button.pg-sg-primary:hover:not(:disabled){background:#1d4ed8}
      #${ID} .pg-sg-bar button{border-radius:999px}
      #${ID} kbd{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;padding:1px 5px;border:1px solid #334155;border-radius:4px;color:#cbd5e1}
    `;
    document.head.appendChild(style);
  }

  function shell(title: string, variant: 'select' | 'review'): HTMLDivElement {
    cleanup(); cleanup = () => {};
    root?.remove();
    injectStyles();
    root = document.createElement('div');
    const container = root;
    container.id = ID; container.tabIndex = -1; container.className = `pg-sg-${variant}`;
    container.setAttribute('role', 'dialog'); container.setAttribute('aria-modal', 'true'); container.setAttribute('aria-label', title);
    container.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !sending) { event.preventDefault(); event.stopPropagation(); close(); }
      if (event.key === 'Tab') {
        const elements = [...container.querySelectorAll<HTMLElement>('button:not(:disabled),textarea,input:not(:disabled)')];
        const first = elements[0], last = elements.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === container)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
    document.body.appendChild(container); return container;
  }
  function button(parent: HTMLElement, label: string, action: () => void, primary = false): HTMLButtonElement {
    const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = label;
    if (primary) btn.className = 'pg-sg-primary';
    btn.onclick = action; parent.append(btn); return btn;
  }
  function text(parent: HTMLElement, tag: string, content: string, className = ''): HTMLElement {
    const el = document.createElement(tag); el.textContent = content; if (className) el.className = className; parent.append(el); return el;
  }

  function selectPage(): void {
    const container = shell('Select current page region', 'select');
    const bar = document.createElement('div'); bar.className = 'pg-sg-bar';
    const status = document.createElement('span'); status.setAttribute('role', 'status');
    const idle = 'Drag directly on this page to capture a region. Esc cancels.';
    status.textContent = idle;
    bar.append(status);
    const cancel = button(bar, 'Cancel', close);
    const selection = document.createElement('div'); selection.className = 'pg-sg-rect'; selection.hidden = true;
    const size = document.createElement('span'); size.className = 'pg-sg-size'; selection.append(size);
    container.append(bar, selection); cancel.focus({ preventScroll: true });
    let start: { x: number; y: number } | null = null, capturing = false;
    const setStatus = (message: string, alert = false) => { status.setAttribute('role', alert ? 'alert' : 'status'); status.textContent = message; };
    const reset = () => { start = null; selection.hidden = true; };
    const onMove = () => {
      reset();
      if (capturing) generation++; // Discard a rasterization made stale by any nested/page scroll.
      setStatus('Page moved. Start a new selection, or Cancel.');
    };
    window.addEventListener('scroll', onMove, true); window.addEventListener('resize', onMove);
    cleanup = () => { window.removeEventListener('scroll', onMove, true); window.removeEventListener('resize', onMove); };
    const point = (event: PointerEvent) => ({ x: Math.max(0, Math.min(innerWidth, event.clientX)), y: Math.max(0, Math.min(innerHeight, event.clientY)) });
    const regionAt = (p: { x: number; y: number }): PageRegion => ({ x: Math.round(Math.min(p.x, start!.x)), y: Math.round(Math.min(p.y, start!.y)), width: Math.round(Math.abs(p.x - start!.x)), height: Math.round(Math.abs(p.y - start!.y)) });
    container.onpointerdown = (event) => {
      if (event.button !== 0 || capturing || bar.contains(event.target as Node)) return;
      event.preventDefault(); event.stopPropagation(); start = point(event);
      container.setPointerCapture(event.pointerId); setStatus(idle);
    };
    container.onpointermove = (event) => {
      if (!start || capturing) return;
      const r = regionAt(point(event)); selection.hidden = false;
      Object.assign(selection.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` });
      size.textContent = `${r.width} × ${r.height}`; status.textContent = `${r.width} × ${r.height} CSS pixels`;
    };
    container.onpointercancel = reset;
    container.onpointerup = (event) => {
      if (!start || capturing) return;
      const region = regionAt(point(event)); reset();
      if (region.width < 8 || region.height < 8) { setStatus('Select at least 8 × 8 CSS pixels.'); return; }
      capturing = true; setStatus('Rendering region… Esc to discard.');
      const token = ++generation, sx = scrollX, sy = scrollY;
      void capturePageRegion(region).then(({ canvas, notes }) => {
        if (token !== generation) return;
        const data = canvas.toDataURL('image/png').split(',')[1];
        if (!data || data.length * 3 / 4 > MAX_PNG_BYTES) throw new Error('Region exceeds the 2 MiB PNG limit. Select a smaller region.');
        preview({ mimeType: 'image/png', data, width: canvas.width, height: canvas.height, region: { ...region, x: region.x + sx, y: region.y + sy }, comment: '' }, notes);
      }).catch((error) => {
        if (token !== generation) return;
        setStatus(error instanceof Error ? error.message : 'Cannot capture this region. Cancel or try another region.', true);
      }).finally(() => { capturing = false; });
    };
  }

  function preview(grab: ScreenGrab, notes: string[] = []): void {
    const container = shell('Review screenshot', 'review');
    const card = document.createElement('div'); card.className = 'pg-sg-card'; container.append(card);
    const head = document.createElement('div'); head.className = 'pg-sg-head'; card.append(head);
    text(head, 'h2', 'Review screenshot');
    text(head, 'span', `${grab.width} × ${grab.height} image pixels`, 'pg-sg-chip');
    const frame = document.createElement('div'); frame.className = 'pg-sg-image'; card.append(frame);
    const image = document.createElement('img'); image.src = `data:image/png;base64,${grab.data}`; image.alt = 'Selected screenshot region'; frame.append(image);
    for (const note of notes) text(card, 'p', note, 'pg-sg-note pg-sg-warn');
    text(card, 'p', 'Rendered from the page DOM. Text fields are redacted; check for anything else sensitive before sending.', 'pg-sg-note');
    const label = document.createElement('label'); label.textContent = 'Comment'; label.htmlFor = `${ID}-comment`; card.append(label);
    const input = document.createElement('textarea'); input.id = `${ID}-comment`; input.setAttribute('aria-label', 'Comment'); input.maxLength = 10000;
    input.placeholder = 'What should change here?'; card.append(input);
    const status = document.createElement('p'); status.setAttribute('role', 'status'); card.append(status);
    const actions = document.createElement('div'); actions.className = 'pg-sg-actions'; card.append(actions);
    const retake = button(actions, 'Retake', selectPage), cancel = button(actions, 'Cancel', close);
    const spacer = document.createElement('span'); spacer.className = 'pg-sg-spacer'; actions.append(spacer);
    const send = button(actions, 'Send image + comment', () => {
      if (sending) return;
      sending = true; send.disabled = true; retake.disabled = true; cancel.disabled = true; status.style.color = '#94a3b8'; status.textContent = 'Sending…';
      const token = generation, submission = { ...grab, comment: input.value.trim() };
      void Promise.resolve().then(() => callbacks.onSubmit(submission)).then(() => { if (token === generation) close(); }).catch((error) => {
        if (token === generation) { status.style.color = ''; status.textContent = error instanceof Error ? error.message : 'Send failed. Please retry.'; }
      }).finally(() => { sending = false; send.disabled = false; retake.disabled = false; cancel.disabled = false; });
    }, true);
    send.title = 'Ctrl/Cmd + Enter';
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); send.click(); } });
    input.focus({ preventScroll: true });
  }
  return {
    open() { if (root) return; returnFocus = document.activeElement as HTMLElement | null; callbacks.onBusy(true); selectPage(); },
    isOpen: () => !!root,
    dispose() { close(); document.getElementById(STYLE_ID)?.remove(); },
  };
}
