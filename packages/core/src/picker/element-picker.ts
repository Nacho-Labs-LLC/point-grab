import type { OverlayRenderer } from '../overlay/overlay-renderer';
import type { Crosshair } from '../overlay/crosshair';
import type { ComponentResolver, SourceResolver, ClassFilter } from '../types';
import { filterFrameworkClasses } from '../utils';

export interface ElementPicker {
  activate(): void;
  deactivate(): void;
  getHoveredElement(): Element | null;
  dispose(): void;
}

export interface ElementPickerDeps {
  overlay: OverlayRenderer;
  crosshair: Crosshair;
  getComponentResolver: () => ComponentResolver | null;
  getSourceResolver: () => SourceResolver | null;
  getClassFilters?: () => ClassFilter[];
  isToolbarElement?: (el: Element) => boolean;
  getFreezeElement?: () => HTMLElement | null;
  onHover: (element: Element | null) => void;
  onSelect: (element: Element) => void;
}

export function createElementPicker(deps: ElementPickerDeps): ElementPicker {
  let hoveredElement: Element | null = null;
  let listening = false;

  function resolveComponentName(el: Element): string | null {
    const resolver = deps.getComponentResolver();
    if (!resolver) return null;

    const result = resolver(el);
    return result?.name ?? null;
  }

  function resolveSourcePath(el: Element): string | null {
    const resolver = deps.getSourceResolver();
    if (!resolver) return null;

    const result = resolver(el);
    if (!result?.filePath) return null;

    let path = result.filePath;
    if (result.line != null) {
      path += `:${result.line}`;
    }
    return path;
  }

  function elementAtPoint(x: number, y: number): Element | null {
    // Temporarily hide freeze overlay so elementFromPoint can see through it
    const freezeEl = deps.getFreezeElement?.();
    if (freezeEl) freezeEl.style.pointerEvents = 'none';
    const target = document.elementFromPoint(x, y);
    if (freezeEl) freezeEl.style.pointerEvents = 'auto';
    return target;
  }

  function handleMouseMove(e: MouseEvent): void {
    const target = elementAtPoint(e.clientX, e.clientY);
    if (!target || deps.overlay.isOverlayElement(target)) return;
    if (deps.crosshair.isCrosshairElement(target)) return;
    if (deps.isToolbarElement?.(target)) return;
    if (target === hoveredElement) return;

    hoveredElement = target;
    const componentName = resolveComponentName(target);
    const sourcePath = resolveSourcePath(target);
    const filters = deps.getClassFilters?.() ?? [];
    const cssClasses = filterFrameworkClasses(target.classList, filters);
    deps.overlay.show(target, componentName, sourcePath, cssClasses);
    deps.onHover(target);
  }

  function handleClick(e: MouseEvent): void {
    const target = elementAtPoint(e.clientX, e.clientY);
    if (target && (deps.isToolbarElement?.(target) || deps.crosshair.isCrosshairElement(target))) return;

    e.preventDefault();
    e.stopPropagation();

    if (hoveredElement) {
      deps.onSelect(hoveredElement);
    }
  }

  return {
    activate(): void {
      if (listening) return;
      listening = true;
      deps.crosshair.activate();
      document.addEventListener('mousemove', handleMouseMove, true);
      document.addEventListener('click', handleClick, true);
    },

    deactivate(): void {
      if (!listening) return;
      listening = false;
      hoveredElement = null;
      deps.crosshair.deactivate();
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
      deps.overlay.hide();
      deps.onHover(null);
    },

    getHoveredElement(): Element | null {
      return hoveredElement;
    },

    dispose(): void {
      this.deactivate();
    },
  };
}
