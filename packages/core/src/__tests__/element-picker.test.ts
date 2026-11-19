// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createElementPicker } from '../picker/element-picker';

afterEach(() => { document.body.innerHTML = ''; });

function setup(atPoint: () => Element | null) {
  const page = document.createElement('p'); page.textContent = 'page text';
  const ui = document.createElement('div'); ui.id = 'point-grab-ui';
  const button = document.createElement('button'); button.textContent = 'Add to Review'; ui.append(button);
  document.body.append(page, ui);
  const onSelect = vi.fn();
  const picker = createElementPicker({
    overlay: { show: vi.fn(), hide: vi.fn(), isOverlayElement: () => false } as any,
    crosshair: { activate: vi.fn(), deactivate: vi.fn(), isCrosshairElement: () => false } as any,
    getComponentResolver: () => null, getSourceResolver: () => null,
    isToolbarElement: (el) => ui.contains(el),
    getElementFromPoint: () => (_x, _y) => atPoint(),
    onHover: vi.fn(), onSelect,
  });
  picker.activate();
  return { page, button, onSelect, picker };
}

it('a click on Point Grab UI is never taken as a pick, even when elementFromPoint disagrees', () => {
  let under: Element | null = null;
  const { page, button, onSelect, picker } = setup(() => under);
  under = page;
  document.dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: 5, bubbles: true }));
  // The coordinate lookup still reports the page element (e.g. mid-transition), but the
  // event really targets the popover's button: it must reach the button untouched.
  const onButton = vi.fn();
  button.addEventListener('click', onButton);
  const click = new MouseEvent('click', { clientX: 5, clientY: 5, bubbles: true, cancelable: true });
  button.dispatchEvent(click);
  expect(onSelect).not.toHaveBeenCalled();
  expect(click.defaultPrevented).toBe(false);
  expect(onButton).toHaveBeenCalledOnce();
  picker.dispose();
});

it('a click on the page still picks the hovered element', () => {
  let under: Element | null = null;
  const { page, onSelect, picker } = setup(() => under);
  under = page;
  document.dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: 5, bubbles: true }));
  const click = new MouseEvent('click', { clientX: 5, clientY: 5, bubbles: true, cancelable: true });
  page.dispatchEvent(click);
  expect(onSelect).toHaveBeenCalledWith(page);
  expect(click.defaultPrevented).toBe(true);
  picker.dispose();
});

it('while frozen, a click on the freeze layer still picks the element beneath it', () => {
  const page = document.createElement('p'); const freeze = document.createElement('div');
  document.body.append(page, freeze);
  const onSelect = vi.fn();
  const picker = createElementPicker({
    overlay: { show: vi.fn(), hide: vi.fn(), isOverlayElement: () => false } as any,
    crosshair: { activate: vi.fn(), deactivate: vi.fn(), isCrosshairElement: () => false } as any,
    getComponentResolver: () => null, getSourceResolver: () => null,
    isToolbarElement: (el) => el === freeze, // grab.ts counts the freeze layer as its own UI
    getFreezeElement: () => freeze,
    getElementFromPoint: () => () => page,
    onHover: vi.fn(), onSelect,
  });
  picker.activate();
  document.dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: 5, bubbles: true }));
  freeze.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5, bubbles: true, cancelable: true }));
  expect(onSelect).toHaveBeenCalledWith(page);
  picker.dispose();
});
