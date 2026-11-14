import type { ScreenGrab } from './types';
import { capturePageRegion, type PageRegion } from './page-capture';

const ID = '__point-grab-screen-grab__';
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

  function shell(title: string): HTMLDivElement {
    cleanup(); cleanup = () => {};
    root?.remove();
    root = document.createElement('div');
    const container = root;
    container.id = ID; container.tabIndex = -1;
    container.setAttribute('role', 'dialog'); container.setAttribute('aria-modal', 'true'); container.setAttribute('aria-label', title);
    container.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#020617ed;display:flex;align-items:center;justify-content:center;color:#f8fafc;font:14px system-ui;';
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
  function panel(title: string): HTMLDivElement {
    const container = shell(title), box = document.createElement('div');
    box.style.cssText = 'background:#0f172a;padding:24px;border:1px solid #64748b;border-radius:16px;width:min(560px,90vw);max-height:90vh;overflow:auto;box-sizing:border-box;';
    const heading = document.createElement('h2'); heading.textContent = title; box.append(heading); container.append(box); return box;
  }
  function button(box: HTMLElement, label: string, action: () => void): HTMLButtonElement {
    const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = label;
    btn.style.cssText = 'padding:9px 14px;margin:8px 8px 0 0;border:1px solid #94a3b8;border-radius:6px;background:#1e293b;color:white;cursor:pointer;font:inherit;';
    btn.onclick = action; box.append(btn); return btn;
  }

  function selectPage(): void {
    const container = shell('Select current page region');
    container.style.background = 'transparent'; container.style.cursor = 'crosshair'; container.style.touchAction = 'none'; container.style.userSelect = 'none';
    const help = document.createElement('div'); help.style.cssText = 'position:absolute;top:12px;left:12px;right:12px;padding:12px;background:#0f172a;border:1px solid #64748b;border-radius:8px;cursor:default;';
    help.textContent = 'Drag directly on this page to capture a region (at least 8 × 8 CSS pixels). Escape to cancel. Scroll before opening; scrolling/resizing invalidates a drag. DOM-rendered preview, not OS pixels. Editable fields are redacted. Nothing is sent until Send. ';
    const status = document.createElement('span'); status.setAttribute('role', 'status'); help.append(status);
    help.style.pointerEvents = 'none';
    const cancel = button(help, 'Cancel', close); cancel.style.pointerEvents = 'auto';
    const selection = document.createElement('div'); selection.style.cssText = 'position:absolute;border:2px solid #38bdf8;background:#38bdf822;pointer-events:none;box-sizing:border-box;';
    container.append(help, selection); cancel.focus({ preventScroll: true });
    let start: { x: number; y: number } | null = null, capturing = false;
    const reset = () => { start = null; selection.style.width = '0'; selection.style.height = '0'; };
    const onMove = () => {
      reset();
      if (capturing) generation++; // Discard a rasterization made stale by any nested/page scroll.
      status.textContent = 'Page moved. Start a new selection, or Cancel.';
    };
    window.addEventListener('scroll', onMove, true); window.addEventListener('resize', onMove);
    cleanup = () => { window.removeEventListener('scroll', onMove, true); window.removeEventListener('resize', onMove); };
    const point = (event: PointerEvent) => ({ x: Math.max(0, Math.min(innerWidth, event.clientX)), y: Math.max(0, Math.min(innerHeight, event.clientY)) });
    const regionAt = (p: { x: number; y: number }): PageRegion => ({ x: Math.round(Math.min(p.x, start!.x)), y: Math.round(Math.min(p.y, start!.y)), width: Math.round(Math.abs(p.x - start!.x)), height: Math.round(Math.abs(p.y - start!.y)) });
    container.onpointerdown = (event) => {
      if (event.button !== 0 || capturing || help.contains(event.target as Node)) return;
      event.preventDefault(); event.stopPropagation(); start = point(event);
      container.setPointerCapture(event.pointerId); status.removeAttribute('role'); status.setAttribute('role', 'status'); status.textContent = '';
    };
    container.onpointermove = (event) => {
      if (!start || capturing) return;
      const r = regionAt(point(event)); Object.assign(selection.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` }); status.textContent = `${r.width} × ${r.height} CSS pixels`;
    };
    container.onpointercancel = reset;
    container.onpointerup = (event) => {
      if (!start || capturing) return;
      const region = regionAt(point(event)); reset();
      if (region.width < 8 || region.height < 8) { status.textContent = 'Select at least 8 × 8 CSS pixels.'; return; }
      capturing = true; status.textContent = 'Rendering page region… Escape or Cancel to discard.';
      const token = ++generation, sx = scrollX, sy = scrollY;
      void capturePageRegion(region).then((canvas) => {
        if (token !== generation) return;
        const data = canvas.toDataURL('image/png').split(',')[1];
        if (!data || data.length * 3 / 4 > MAX_PNG_BYTES) throw new Error('Region exceeds the 2 MiB PNG limit. Select a smaller region.');
        preview({ mimeType: 'image/png', data, width: canvas.width, height: canvas.height, region: { ...region, x: region.x + sx, y: region.y + sy }, comment: '' });
      }).catch((error) => {
        if (token !== generation) return;
        status.setAttribute('role', 'alert'); status.textContent = error instanceof Error ? error.message : 'Cannot capture this region. Cancel or try another region.';
      }).finally(() => { capturing = false; });
    };
  }

  function preview(grab: ScreenGrab): void {
    const box = panel('Review screenshot');
    const image = document.createElement('img'); image.src = `data:image/png;base64,${grab.data}`;
    image.alt = 'Selected screenshot region'; image.style.cssText = 'display:block;max-width:100%;max-height:45vh;object-fit:contain;'; box.append(image);
    const dimensions = document.createElement('p'); dimensions.textContent = `${grab.width} × ${grab.height} image pixels`; box.append(dimensions);
    const warning = document.createElement('p'); warning.textContent = 'Review carefully before sending: DOM-rendered approximation, not browser/OS screenshot pixels. Fonts, complex CSS and animations may differ. Editable inputs and marked private content are redacted; other page text may contain sensitive information. Cancel if anything is wrong.'; box.append(warning);
    const label = document.createElement('label'); label.textContent = 'Comment';
    const input = document.createElement('textarea'); input.setAttribute('aria-label', 'Comment'); input.maxLength = 10000;
    input.style.cssText = 'display:block;width:100%;box-sizing:border-box;min-height:80px;margin:12px 0;'; label.append(input); box.append(label);
    const status = document.createElement('p'); status.setAttribute('role', 'status'); box.append(status);
    const note = document.createElement('p'); note.textContent = 'Send stores only this crop and comment through your configured image transport (default: local PointGrab MCP server). Clipboard is unchanged. Cancel discards this preview.'; box.append(note);
    const send = button(box, 'Send image + comment', () => {
      if (sending) return;
      sending = true; send.disabled = true; retake.disabled = true; cancel.disabled = true; status.textContent = 'Sending…';
      const token = generation, submission = { ...grab, comment: input.value.trim() };
      void Promise.resolve().then(() => callbacks.onSubmit(submission)).then(() => { if (token === generation) close(); }).catch((error) => {
        if (token === generation) status.textContent = error instanceof Error ? error.message : 'Send failed. Please retry.';
      }).finally(() => { sending = false; send.disabled = false; retake.disabled = false; cancel.disabled = false; });
    });
    const retake = button(box, 'Retake', selectPage), cancel = button(box, 'Cancel', close); input.focus({ preventScroll: true });
  }
  return {
    open() { if (root) return; returnFocus = document.activeElement as HTMLElement | null; callbacks.onBusy(true); selectPage(); },
    isOpen: () => !!root, dispose: close,
  };
}
