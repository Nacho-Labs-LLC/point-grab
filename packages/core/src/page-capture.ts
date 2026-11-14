import html2canvas from 'html2canvas';

export interface PageRegion { x: number; y: number; width: number; height: number }
export const isPointGrabUI = (element: Element): boolean => !!element.closest('[id^="__point-grab-"]');
const PRIVATE = 'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[data-point-grab-private]';

/**
 * Preflight: never knowingly return an image with missing content as a successful capture.
 * Returns notes for cosmetic effects that are rendered approximately (not omitted).
 */
export function checkPageRegion(region: PageRegion): string[] {
  const notes = new Set<string>();
  const fail = (reason: string): never => { throw new Error(`Cannot capture this region: ${reason}. Select a different region or Cancel. No image was sent.`); };
  const visit = (root: Document | ShadowRoot): void => {
    for (const element of root.querySelectorAll('*')) {
      if (isPointGrabUI(element)) continue;
      // Open shadow roots are flattened by the renderer (including slotted content).
      if (element.shadowRoot) visit(element.shadowRoot);
      if (element.closest(PRIVATE)) continue;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.right <= region.x || rect.bottom <= region.y || rect.left >= region.x + region.width || rect.top >= region.y + region.height) continue;
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;
      if (element.matches('iframe,video,object,embed')) fail(`${element.tagName.toLowerCase()} content cannot be captured from the page`);
      if (element instanceof HTMLCanvasElement && !is2dCanvas(element)) fail('WebGL canvas content cannot be captured from the page');
      if ((style.filter && style.filter !== 'none') || (style.backdropFilter && style.backdropFilter !== 'none')) notes.add('Blur and CSS filter effects are shown without the filter.');
      if (style.mixBlendMode && style.mixBlendMode !== 'normal') notes.add('Blend modes are shown unblended.');
      if (element instanceof HTMLImageElement) {
        const src = element.currentSrc || element.src;
        if (src && !src.startsWith('data:') && !src.startsWith('blob:') && new URL(src, location.href).origin !== location.origin) fail('cross-origin images cannot be captured');
        if (!element.complete || !element.naturalWidth) fail('an image is missing or still loading');
      }
      for (const url of style.backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
        if (!url[1].startsWith('data:') && !url[1].startsWith('blob:') && new URL(url[1], location.href).origin !== location.origin) fail('cross-origin background images cannot be captured');
      }
    }
  };
  visit(document);
  return [...notes];
}

/** A canvas with a WebGL context returns null for '2d'; an unused canvas is blank either way. */
function is2dCanvas(canvas: HTMLCanvasElement): boolean {
  try { return canvas.getContext('2d') !== null; } catch { return false; }
}

/** DOM reconstruction, NOT browser-compositor or OS pixels. Coordinates are viewport CSS pixels. */
export interface PageCapture { canvas: HTMLCanvasElement; notes: string[] }

export async function capturePageRegion(region: PageRegion): Promise<PageCapture> {
  const sx = window.scrollX, sy = window.scrollY, vw = window.innerWidth, vh = window.innerHeight;
  const scale = window.devicePixelRatio || 1;
  if (region.width < 8 || region.height < 8) throw new Error('Select at least 8 × 8 CSS pixels.');
  if (region.width * scale > 8192 || region.height * scale > 8192 || region.width * region.height * scale * scale > 16777216) throw new Error('Region exceeds the image dimension limit. Select a smaller region.');
  const notes = checkPageRegion(region);
  await document.fonts?.ready;
  const canvas = await html2canvas(document.documentElement, {
    x: sx + region.x, y: sy + region.y, width: region.width, height: region.height,
    windowWidth: vw, windowHeight: vh, scrollX: sx, scrollY: sy, scale,
    logging: false, useCORS: false, allowTaint: false, imageTimeout: 5000,
    ignoreElements: isPointGrabUI,
    onclone: (clone) => {
      // html2canvas restores scroll before onclone; smooth-scroll CSS otherwise leaves
      // the cloned viewport at the top and silently captures the wrong page region.
      clone.documentElement.style.setProperty('scroll-behavior', 'auto', 'important');
      clone.defaultView?.scrollTo({ left: sx, top: sy, behavior: 'instant' as ScrollBehavior });
      // Redact ALL editable fields, including non-password/autofilled fields, in the clone only.
      for (const element of clone.querySelectorAll<HTMLElement>(PRIVATE)) {
        element.style.setProperty('visibility', 'hidden', 'important');
        if (element instanceof clone.defaultView!.HTMLInputElement || element instanceof clone.defaultView!.HTMLTextAreaElement) element.value = '';
        element.removeAttribute('value'); element.textContent = '';
      }
    },
  });
  if (sx !== scrollX || sy !== scrollY || vw !== innerWidth || vh !== innerHeight) throw new Error('Page moved during capture. Retake the region.');
  return { canvas, notes };
}
