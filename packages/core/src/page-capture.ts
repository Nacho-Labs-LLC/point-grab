
export interface PageRegion { x: number; y: number; width: number; height: number }
export const isPointGrabUI = (element: Element): boolean => !!element.closest('[id^="__point-grab-"]');
const PRIVATE = 'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[data-point-grab-private]';

const MEDIA = 'iframe,video,object,embed';

/**
 * Preflight: never knowingly return an image with missing content as a successful capture.
 * Returns notes for effects that are rendered approximately (not omitted).
 * Read-only: never initializes a canvas context or otherwise mutates the live page.
 */
export function checkPageRegion(region: PageRegion): string[] {
  const notes = new Set<string>();
  const fail = (reason: string): never => { throw new Error(`Cannot capture this region: ${reason}. Select a different region or Cancel. No image was sent.`); };
  const overlaps = (r: { left: number; top: number; right: number; bottom: number }) =>
    r.right > region.x && r.bottom > region.y && r.left < region.x + region.width && r.top < region.y + region.height;
  const visit = (root: Document | ShadowRoot): void => {
    for (const element of root.querySelectorAll('*')) {
      if (isPointGrabUI(element) || element.closest(PRIVATE)) continue; // private hosts: skip their shadow trees too
      // Open shadow roots are flattened by the renderer (including slotted content).
      if (element.shadowRoot) visit(element.shadowRoot);
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height || !overlaps(rect)) continue;
      const style = getComputedStyle(element);
      const isImage = element instanceof HTMLImageElement;
      const bgUrls = style.backgroundImage.includes('url(') ? [...style.backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((m) => m[1]) : [];
      const cosmetic = (style.filter && style.filter !== 'none') || (style.backdropFilter && style.backdropFilter !== 'none') || (style.mixBlendMode && style.mixBlendMode !== 'normal');
      const risky = element.matches(MEDIA) || element instanceof HTMLCanvasElement || isImage || bgUrls.length > 0;
      if (!risky && !cosmetic) continue;
      if (!isShown(element, style) || !overlaps(clippedRect(element, rect))) continue;
      if ((style.filter && style.filter !== 'none') || (style.backdropFilter && style.backdropFilter !== 'none')) notes.add('Blur and CSS filter effects are shown without the filter.');
      if (style.mixBlendMode && style.mixBlendMode !== 'normal') notes.add('Blend modes are shown unblended.');
      if (element.matches(MEDIA)) fail(`${element.tagName.toLowerCase()} content cannot be captured from the page`);
      if (element instanceof HTMLCanvasElement) checkCanvas(element, fail, notes);
      if (isImage) {
        const src = element.currentSrc || element.src;
        if (src && isCrossOrigin(src)) fail('cross-origin images cannot be captured');
        if (!element.complete || !element.naturalWidth) fail('an image is missing or still loading');
      }
      if (bgUrls.some(isCrossOrigin)) fail('cross-origin background images cannot be captured');
    }
  };
  visit(document);
  return [...notes];
}

function isCrossOrigin(url: string): boolean {
  if (url.startsWith('data:') || url.startsWith('blob:')) return false;
  try { return new URL(url, location.href).origin !== location.origin; } catch { return false; } // unparsable: never loads
}

/** Hidden by itself or any ancestor (including opacity: 0 and content-visibility). */
function isShown(element: Element, style: CSSStyleDeclaration): boolean {
  if (typeof element.checkVisibility === 'function') return element.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true });
  return style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
}

/** The element's box intersected with every clipping ancestor (crossing shadow roots). */
function clippedRect(element: Element, rect: DOMRect): { left: number; top: number; right: number; bottom: number } {
  let { left, top, right, bottom } = rect;
  for (let node: Element | null = parentOf(element); node && node !== document.documentElement; node = parentOf(node)) {
    const style = getComputedStyle(node);
    if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
    const clip = node.getBoundingClientRect();
    left = Math.max(left, clip.left); top = Math.max(top, clip.top); right = Math.min(right, clip.right); bottom = Math.min(bottom, clip.bottom);
    if (right <= left || bottom <= top) break;
  }
  return { left, top, right, bottom };
}

function parentOf(element: Element): Element | null {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

/** Export (never getContext) so an uninitialized canvas keeps its context mode. */
function checkCanvas(canvas: HTMLCanvasElement, fail: (reason: string) => never, notes: Set<string>): void {
  if (!canvas.width || !canvas.height) return;
  let exported: string;
  try { exported = canvas.toDataURL(); } catch { return fail('canvas content drawn from another origin cannot be captured'); }
  const blank = document.createElement('canvas'); blank.width = canvas.width; blank.height = canvas.height;
  if (exported === blank.toDataURL()) notes.add('A WebGL or empty canvas in this region appears blank.');
}

/** DOM reconstruction, NOT browser-compositor or OS pixels. Coordinates are viewport CSS pixels. */
export interface PageCapture { canvas: HTMLCanvasElement; notes: string[] }

export async function capturePageRegion(region: PageRegion): Promise<PageCapture> {
  const sx = window.scrollX, sy = window.scrollY, vw = window.innerWidth, vh = window.innerHeight;
  const scale = window.devicePixelRatio || 1;
  if (region.width < 8 || region.height < 8) throw new Error('Select at least 8 × 8 CSS pixels.');
  if (region.width * scale > 8192 || region.height * scale > 8192 || region.width * region.height * scale * scale > 16777216) throw new Error('Region exceeds the image dimension limit. Select a smaller region.');
  const notes = checkPageRegion(region);
  // Loaded on first capture so apps that never take a screenshot don't ship the renderer.
  const [{ default: html2canvas }] = await Promise.all([import('html2canvas'), document.fonts?.ready]);
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
      // Hide (rather than empty) so layout is unchanged; hide descendants too so a
      // child's own `visibility: visible` cannot re-reveal content.
      const view = clone.defaultView!;
      for (const element of clone.querySelectorAll<HTMLElement>(PRIVATE)) {
        for (const node of [element, ...element.querySelectorAll<HTMLElement>('*')]) {
          node.style.setProperty('visibility', 'hidden', 'important');
          if (node instanceof view.HTMLInputElement || node instanceof view.HTMLTextAreaElement) { node.value = ''; node.removeAttribute('value'); node.placeholder = ''; }
        }
      }
    },
  });
  if (sx !== scrollX || sy !== scrollY || vw !== innerWidth || vh !== innerHeight) throw new Error('Page moved during capture. Retake the region.');
  return { canvas, notes };
}
