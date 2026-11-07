import type { ScreenGrab } from './types';

const ID = '__point-grab-screen-grab__';
const MAX_PNG_BYTES = 2 * 1024 * 1024;
const SOURCE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** User-provided pixels only: no DOM rendering, screen sharing, or clipboard reads. */
export function createScreenGrab(callbacks: {
  onSubmit: (grab: ScreenGrab) => Promise<void>;
  onBusy: (busy: boolean) => void;
}) {
  let root: HTMLDivElement | null = null;
  let frame: HTMLCanvasElement | null = null;
  let generation = 0;
  let returnFocus: HTMLElement | null = null;
  let sending = false;

  function close(): void {
    generation++;
    root?.remove(); root = null; frame = null;
    callbacks.onBusy(false);
    returnFocus?.focus();
  }

  function shell(title: string): HTMLDivElement {
    root?.remove();
    root = document.createElement('div');
    const container = root;
    container.id = ID;
    container.tabIndex = -1;
    container.setAttribute('role', 'dialog');
    container.setAttribute('aria-modal', 'true');
    container.setAttribute('aria-label', title);
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
    document.body.appendChild(container);
    return container;
  }

  function panel(title: string): HTMLDivElement {
    const container = shell(title);
    const box = document.createElement('div');
    box.style.cssText = 'background:#0f172a;padding:24px;border:1px solid #64748b;border-radius:16px;width:min(560px,90vw);max-height:90vh;overflow:auto;box-sizing:border-box;';
    const heading = document.createElement('h2'); heading.textContent = title;
    box.append(heading); container.append(box);
    return box;
  }

  function button(box: HTMLElement, label: string, action: () => void): HTMLButtonElement {
    const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = label;
    btn.style.cssText = 'padding:9px 14px;margin:8px 8px 0 0;border:1px solid #94a3b8;border-radius:6px;background:#1e293b;color:white;cursor:pointer;font:inherit;';
    btn.onclick = action; box.append(btn); return btn;
  }

  function intake(message = ''): void {
    const box = panel('Add or paste a screenshot');
    const container = root!;
    const text = document.createElement('p');
    text.textContent = 'Paste an image while this dialog is focused, choose a screenshot file, or drop one here. Take your screenshot with your system screenshot tool first. Nothing is sent before Send. Clipboard is unchanged. PNG, JPEG or WebP, up to 20 MiB.';
    box.append(text);
    const file = document.createElement('input'); file.type = 'file'; file.accept = SOURCE_TYPES.join(',');
    file.setAttribute('aria-label', 'Screenshot file'); file.style.maxWidth = '100%'; box.append(file);
    file.onchange = () => { if (file.files?.[0]) void load(file.files[0]); };
    container.addEventListener('paste', (event) => {
      const item = [...(event.clipboardData?.items ?? [])].find((item) => item.kind === 'file' && item.type.startsWith('image/'));
      const image = item?.getAsFile();
      if (!image) return; // Never intercept ordinary text paste.
      event.preventDefault(); event.stopPropagation(); void load(image);
    });
    container.addEventListener('dragover', (event) => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'; });
    container.addEventListener('drop', (event) => {
      event.preventDefault(); event.stopPropagation();
      if (event.dataTransfer?.files[0]) void load(event.dataTransfer.files[0]);
    });
    if (message) { const error = document.createElement('p'); error.setAttribute('role', 'alert'); error.textContent = message; box.append(error); }
    button(box, 'Cancel', close);
    file.focus();
  }

  async function load(file: File): Promise<void> {
    const token = ++generation;
    let url: string | undefined;
    try {
      if (!SOURCE_TYPES.includes(file.type)) throw new Error('Choose a PNG, JPEG or WebP screenshot.');
      if (file.size > 20 * 1024 * 1024) throw new Error('Screenshot file exceeds 20 MiB. Choose a smaller image.');
      url = URL.createObjectURL(file);
      const image = new Image(); image.src = url;
      await image.decode();
      if (token !== generation) return;
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth > 16384 || image.naturalHeight > 16384 || image.naturalWidth * image.naturalHeight > 67108864) {
        throw new Error('Screenshot exceeds the source dimension limit (16384 per side, 64 megapixels).');
      }
      const next = document.createElement('canvas'); next.width = image.naturalWidth; next.height = image.naturalHeight;
      next.getContext('2d')!.drawImage(image, 0, 0);
      frame = next;
      selectRegion();
    } catch (error) {
      if (token === generation) { frame = null; intake(error instanceof Error ? `Could not decode screenshot: ${error.message}` : 'Could not decode screenshot. Try another file.'); }
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  }

  function selectRegion(): void {
    const source = frame!;
    const container = shell('Drag a screenshot region');
    container.style.flexDirection = 'column';
    const help = document.createElement('div');
    help.style.cssText = 'flex:none;padding:12px;';
    help.textContent = 'Drag a region (at least 8 × 8 image pixels). Escape to cancel. ';
    const size = document.createElement('span'); size.setAttribute('role', 'status'); size.textContent = `${source.width} × ${source.height} image pixels. `;
    help.append(size);
    button(help, 'Retake', () => { frame = null; intake(); });
    const cancel = button(help, 'Cancel', close);
    const stage = document.createElement('div'); stage.style.cssText = 'position:relative;min-height:0;max-width:100%;';
    const image = document.createElement('canvas'); image.width = source.width; image.height = source.height;
    image.setAttribute('aria-label', 'Screenshot to crop');
    image.getContext('2d')!.drawImage(source, 0, 0);
    image.style.cssText = 'display:block;max-width:100vw;max-height:75vh;width:auto;height:auto;cursor:crosshair;touch-action:none;';
    const selection = document.createElement('div');
    selection.style.cssText = 'position:absolute;border:2px solid #38bdf8;background:#38bdf822;pointer-events:none;box-sizing:border-box;';
    stage.append(image, selection); container.append(help, stage); cancel.focus();
    let start: { x: number; y: number } | null = null;
    function point(e: PointerEvent) {
      const rect = image.getBoundingClientRect();
      return { x: Math.max(0, Math.min(rect.width, e.clientX - rect.left)), y: Math.max(0, Math.min(rect.height, e.clientY - rect.top)) };
    }
    function regionAt(p: { x: number; y: number }) {
      const rect = image.getBoundingClientRect();
      const sx = source.width / rect.width, sy = source.height / rect.height;
      const x = Math.round(Math.min(p.x, start!.x) * sx), y = Math.round(Math.min(p.y, start!.y) * sy);
      return { x, y, width: Math.round(Math.max(p.x, start!.x) * sx) - x, height: Math.round(Math.max(p.y, start!.y) * sy) - y };
    }
    image.onpointerdown = (e) => {
      if (e.button !== 0) return;
      start = point(e); image.setPointerCapture(e.pointerId); e.preventDefault();
    };
    image.onpointermove = (e) => {
      if (!start) return;
      const p = point(e), region = regionAt(p);
      Object.assign(selection.style, { left: `${Math.min(p.x, start.x)}px`, top: `${Math.min(p.y, start.y)}px`, width: `${Math.abs(p.x - start.x)}px`, height: `${Math.abs(p.y - start.y)}px` });
      size.textContent = `${region.width} × ${region.height} image pixels`;
    };
    image.onpointercancel = () => { start = null; selection.style.width = '0'; selection.style.height = '0'; };
    image.onpointerup = (e) => {
      if (!start) return;
      const region = regionAt(point(e)); start = null;
      if (region.width < 8 || region.height < 8) { size.textContent = 'Select at least 8 × 8 image pixels.'; return; }
      if (region.width > 8192 || region.height > 8192 || region.width * region.height > 16777216) {
        size.textContent = 'Region exceeds the image dimension limit. Drag a smaller region.'; return;
      }
      try {
        const crop = document.createElement('canvas'); crop.width = region.width; crop.height = region.height;
        const context = crop.getContext('2d');
        if (!context) throw new Error('Canvas is unavailable.');
        context.drawImage(source, region.x, region.y, region.width, region.height, 0, 0, crop.width, crop.height);
        const data = crop.toDataURL('image/png').split(',')[1];
        if (!data || data.length * 3 / 4 > MAX_PNG_BYTES) { size.textContent = 'Region exceeds the 2 MiB PNG limit. Drag a smaller region.'; return; }
        frame = null;
        preview({ mimeType: 'image/png', data, width: crop.width, height: crop.height, region, comment: '' });
      } catch {
        size.textContent = 'Could not prepare screenshot. Try another region, Retake, or Cancel.';
      }
    };
  }

  function preview(grab: ScreenGrab): void {
    const box = panel('Review screenshot');
    const image = document.createElement('img'); image.src = `data:image/png;base64,${grab.data}`;
    image.alt = 'Selected screenshot region'; image.style.cssText = 'display:block;max-width:100%;max-height:45vh;object-fit:contain;'; box.append(image);
    const dimensions = document.createElement('p'); dimensions.textContent = `${grab.width} × ${grab.height} image pixels`; box.append(dimensions);
    const label = document.createElement('label'); label.textContent = 'Comment';
    const input = document.createElement('textarea'); input.setAttribute('aria-label', 'Comment'); input.maxLength = 10000;
    input.style.cssText = 'display:block;width:100%;box-sizing:border-box;min-height:80px;margin:12px 0;'; label.append(input); box.append(label);
    const status = document.createElement('p'); status.setAttribute('role', 'status'); box.append(status);
    const note = document.createElement('p');
    note.textContent = 'Send stores this crop and comment through your configured image transport (default: local PointGrab MCP server). Clipboard is unchanged. Cancel discards this preview.';
    box.append(note);
    const send = button(box, 'Send image + comment', () => {
      if (sending) return;
      sending = true; send.disabled = true; retake.disabled = true; cancel.disabled = true; status.textContent = 'Sending…';
      const token = generation;
      const submission = { ...grab, comment: input.value.trim() };
      void Promise.resolve().then(() => callbacks.onSubmit(submission)).then(() => {
        if (token === generation) close();
      }).catch((error) => {
        if (token === generation) status.textContent = error instanceof Error ? error.message : 'Send failed. Please retry.';
      }).finally(() => { sending = false; send.disabled = false; retake.disabled = false; cancel.disabled = false; });
    });
    const retake = button(box, 'Retake', () => intake());
    const cancel = button(box, 'Cancel', close);
    input.focus();
  }

  return {
    open() {
      if (root) return;
      returnFocus = document.activeElement as HTMLElement | null;
      callbacks.onBusy(true); intake();
    },
    isOpen: () => !!root,
    dispose: close,
  };
}
