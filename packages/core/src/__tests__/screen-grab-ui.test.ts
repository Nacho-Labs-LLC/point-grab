// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createScreenGrab } from '../screen-grab';

let ui: ReturnType<typeof createScreenGrab> | undefined;
afterEach(() => { ui?.dispose(); document.body.innerHTML = ''; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const flush = async () => { await new Promise((resolve) => setTimeout(resolve, 0)); };
const button = (label: string) => [...document.querySelectorAll('button')].find((el) => el.textContent === label)!;

async function cropSource(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  vi.stubGlobal('Image', class { naturalWidth = 100; naturalHeight = 100; decode = async () => {}; });
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,cG5n');
  ui = createScreenGrab({ onSubmit, onBusy: vi.fn() }); ui.open();
  const input = document.querySelector('input')!;
  Object.defineProperty(input, 'files', { value: [new File(['png'], 'screen.png', { type: 'image/png' })] });
  input.dispatchEvent(new Event('change')); await flush();
  const canvas = document.querySelector('canvas')!;
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100 } as DOMRect);
  canvas.setPointerCapture = vi.fn();
  const drag = () => {
    canvas.onpointerdown!({ button: 0, clientX: 10, clientY: 10, pointerId: 1, preventDefault() {} } as PointerEvent);
    canvas.onpointerup!({ clientX: 50, clientY: 50 } as PointerEvent);
  };
  return { onSubmit, drag };
}

it('recovers from a synchronously throwing transport and preserves the comment for retry', async () => {
  const submit = vi.fn().mockImplementationOnce(() => { throw new Error('Destination offline'); }).mockResolvedValue(undefined);
  const { drag } = await cropSource(submit); drag();
  const comment = document.querySelector('textarea')!; comment.value = 'Keep this comment';
  button('Send image + comment').click(); await flush();
  expect(document.querySelector('[role="status"]')?.textContent).toBe('Destination offline');
  expect(button('Send image + comment').disabled).toBe(false);
  expect(comment.value).toBe('Keep this comment');
  button('Send image + comment').click(); await flush();
  expect(submit).toHaveBeenLastCalledWith(expect.objectContaining({ comment: 'Keep this comment', width: 40, height: 40 }));
  expect(ui!.isOpen()).toBe(false);
});

it('never submits a preview when Retake or Cancel is chosen', async () => {
  const { drag, onSubmit } = await cropSource(); drag();
  document.querySelector('textarea')!.value = 'Unsent comment';
  expect(onSubmit).not.toHaveBeenCalled();
  button('Retake').click();
  expect(document.querySelector('textarea')).toBeNull();
  expect(document.querySelector('[aria-label="Screenshot file"]')).not.toBeNull();
  button('Cancel').click();
  expect(onSubmit).not.toHaveBeenCalled();
  expect(ui!.isOpen()).toBe(false);
});

it('does not intercept ordinary text paste in intake or preview comments', async () => {
  const { drag } = await cropSource();
  drag();
  const comment = document.querySelector('textarea')!;
  const event = new Event('paste', { bubbles: true, cancelable: true });
  comment.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  button('Retake').click();
  const textPaste = new Event('paste', { bubbles: true, cancelable: true });
  document.querySelector('input')!.dispatchEvent(textPaste);
  expect(textPaste.defaultPrevented).toBe(false);
});

it('keeps crop selection usable after a canvas encoding failure', async () => {
  const { drag, onSubmit } = await cropSource();
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementationOnce(() => { throw new Error('Encoding unavailable'); });
  expect(drag).not.toThrow();
  expect(document.querySelector('[role="status"]')?.textContent).toContain('Could not prepare screenshot');
  expect(document.querySelector('canvas')).not.toBeNull();
  expect(onSubmit).not.toHaveBeenCalled();
  drag();
  expect(document.querySelector('[aria-label="Review screenshot"]')).not.toBeNull();
});
