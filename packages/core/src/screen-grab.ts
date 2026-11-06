import type { ScreenGrab } from './types';

const ID = '__point-grab-screen-grab__';
const MAX_PNG_BYTES = 2 * 1024 * 1024;

/** One explicit permission request, one still frame. Sharing never outlives this call. */
export async function captureTab(): Promise<HTMLCanvasElement> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error('Screen Grab requires a secure context and a browser with tab sharing support.');
  }
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true, audio: false,
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
    monitorTypeSurfaces: 'exclude',
  } as DisplayMediaStreamOptions);
  const video = document.createElement('video');
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    if (stream.getVideoTracks()[0]?.getSettings().displaySurface !== 'browser') {
      throw new Error('Choose this browser tab, not a window or entire screen.');
    }
    video.srcObject = stream;
    video.muted = true;
    await Promise.race([
      video.play(),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Tab capture timed out. Please try again.')), 10000); }),
    ]);
    if (!video.videoWidth || !video.videoHeight) throw new Error('No video frame was available.');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    return canvas;
  } finally {
    clearTimeout(timeout);
    stream.getTracks().forEach((track) => track.stop());
    video.pause();
    video.srcObject = null;
  }
}

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
    root.id = ID;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', title);
    root.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#020617d9;display:flex;align-items:center;justify-content:center;color:#f8fafc;font:14px system-ui;';
    root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !sending) { event.preventDefault(); event.stopPropagation(); close(); }
      if (event.key === 'Tab') {
        const elements = [...root!.querySelectorAll<HTMLElement>('button:not(:disabled),textarea')];
        const first = elements[0], last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
    document.body.appendChild(root);
    return root;
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

  function consent(message = ''): void {
    const box = panel('Screen Grab');
    const text = document.createElement('p');
    text.textContent = 'Choose this tab in the browser sharing picker. Only share content you intend to include. Drag a region on the captured still, review it, then Send. Nothing is sent before Send. The image is not copied to your clipboard.';
    box.append(text);
    if (message) { const error = document.createElement('p'); error.setAttribute('role', 'alert'); error.textContent = message; box.append(error); }
    button(box, 'Start sharing', () => { void capture(); }).focus();
    button(box, 'Cancel', close);
  }

  async function capture(): Promise<void> {
    const token = ++generation;
    // Remove PointGrab UI before taking the still; no capture happens until this user click.
    root?.remove(); root = null;
    try {
      frame = await captureTab();
      if (token !== generation) { frame = null; return; }
      selectRegion();
    } catch (error) {
      if (token === generation) consent(error instanceof Error ? error.message : 'Tab sharing was cancelled.');
    }
  }

  function selectRegion(): void {
    const container = shell('Drag a screenshot region');
    container.style.background = '#020617';
    const image = document.createElement('canvas'); image.width = frame!.width; image.height = frame!.height;
    image.getContext('2d')!.drawImage(frame!, 0, 0);
    image.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;cursor:crosshair;touch-action:none;';
    const selection = document.createElement('div');
    selection.style.cssText = 'position:absolute;border:2px solid #38bdf8;background:#38bdf822;pointer-events:none;box-sizing:border-box;';
    const help = document.createElement('div'); help.style.cssText = 'position:absolute;top:12px;left:12px;background:#0f172a;padding:12px;border-radius:8px;';
    help.textContent = 'Drag a region (at least 8 × 8 pixels). Escape to cancel. ';
    button(help, 'Cancel', close).focus();
    container.append(image, selection, help);
    let start: { x: number; y: number } | null = null;
    function point(e: PointerEvent) {
      const rect = image.getBoundingClientRect();
      return { x: Math.max(0, Math.min(rect.width, e.clientX - rect.left)), y: Math.max(0, Math.min(rect.height, e.clientY - rect.top)) };
    }
    image.onpointerdown = (e) => {
      if (e.button !== 0) return;
      start = point(e); image.setPointerCapture(e.pointerId); e.preventDefault();
    };
    image.onpointermove = (e) => {
      if (!start) return;
      const p = point(e);
      Object.assign(selection.style, { left: `${Math.min(p.x, start.x)}px`, top: `${Math.min(p.y, start.y)}px`, width: `${Math.abs(p.x - start.x)}px`, height: `${Math.abs(p.y - start.y)}px` });
    };
    image.onpointercancel = () => { start = null; selection.style.width = '0'; selection.style.height = '0'; };
    image.onpointerup = (e) => {
      if (!start) return;
      const p = point(e), rect = image.getBoundingClientRect();
      const region = { x: Math.min(p.x, start.x), y: Math.min(p.y, start.y), width: Math.abs(p.x - start.x), height: Math.abs(p.y - start.y) };
      start = null;
      if (region.width < 8 || region.height < 8) return;
      const sx = frame!.width / rect.width, sy = frame!.height / rect.height;
      if (region.width * sx > 8192 || region.height * sy > 8192 || region.width * sx * region.height * sy > 16777216) {
        frame = null; consent('Region exceeds the image dimension limit. Please retake a smaller region.'); return;
      }
      const crop = document.createElement('canvas');
      crop.width = Math.max(1, Math.round(region.width * sx)); crop.height = Math.max(1, Math.round(region.height * sy));
      crop.getContext('2d')!.drawImage(frame!, region.x * sx, region.y * sy, region.width * sx, region.height * sy, 0, 0, crop.width, crop.height);
      const data = crop.toDataURL('image/png').split(',')[1];
      if (!data || data.length * 3 / 4 > MAX_PNG_BYTES) { consent('Region exceeds the 2 MiB PNG limit. Please retake a smaller region.'); frame = null; return; }
      frame = null;
      preview({ mimeType: 'image/png', data, width: crop.width, height: crop.height, region, comment: '' });
    };
  }

  function preview(grab: ScreenGrab): void {
    const box = panel('Review Screen Grab');
    const image = document.createElement('img'); image.src = `data:image/png;base64,${grab.data}`;
    image.alt = 'Selected screenshot region'; image.style.cssText = 'display:block;max-width:100%;max-height:45vh;object-fit:contain;'; box.append(image);
    const label = document.createElement('label'); label.textContent = 'Comment';
    const input = document.createElement('textarea'); input.setAttribute('aria-label', 'Comment'); input.maxLength = 10000;
    input.style.cssText = 'display:block;width:100%;box-sizing:border-box;min-height:80px;margin:12px 0;'; label.append(input); box.append(label);
    const status = document.createElement('p'); status.setAttribute('role', 'status'); box.append(status);
    const note = document.createElement('p');
    note.textContent = 'Send stores this image and comment through your configured image transport (default: local PointGrab MCP server). Clipboard is unchanged. Cancel discards this preview.';
    box.append(note);
    const send = button(box, 'Send image + comment', () => {
      if (sending) return;
      sending = true; send.disabled = true; retake.disabled = true; cancel.disabled = true; status.textContent = 'Sending…';
      const token = generation;
      void callbacks.onSubmit({ ...grab, comment: input.value.trim() }).then(() => {
        if (token === generation) close();
      }).catch((error) => {
        if (token === generation) status.textContent = error instanceof Error ? error.message : 'Send failed. Please retry.';
      }).finally(() => { sending = false; send.disabled = false; retake.disabled = false; cancel.disabled = false; });
    });
    const retake = button(box, 'Retake', () => consent());
    const cancel = button(box, 'Cancel', close);
    input.focus();
  }

  return {
    open() {
      if (root) return;
      returnFocus = document.activeElement as HTMLElement | null;
      callbacks.onBusy(true); consent();
    },
    isOpen: () => !!root,
    dispose: close,
  };
}
