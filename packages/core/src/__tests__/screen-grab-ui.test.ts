// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createScreenGrab } from '../screen-grab';
import { capturePageRegion } from '../page-capture';
vi.mock('../page-capture', () => ({ capturePageRegion: vi.fn() }));
let ui: ReturnType<typeof createScreenGrab> | undefined;
afterEach(() => { ui?.dispose(); document.body.innerHTML = ''; vi.restoreAllMocks(); vi.clearAllMocks(); });
const flush = async () => { await new Promise((resolve) => setTimeout(resolve, 0)); };
const button = (label: string) => [...document.querySelectorAll('button')].find((el) => el.textContent === label)!;
function setup(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 40;
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,cG5n');
  vi.mocked(capturePageRegion).mockResolvedValue(canvas);
  ui = createScreenGrab({ onSubmit, onBusy: vi.fn() }); ui.open();
  const drag = async () => {
    const overlay = document.querySelector<HTMLDivElement>('[role="dialog"]')!; overlay.setPointerCapture = vi.fn();
    overlay.onpointerdown!({ target: overlay, button: 0, clientX: 10, clientY: 10, pointerId: 1, preventDefault() {}, stopPropagation() {} } as unknown as PointerEvent);
    overlay.onpointerup!({ clientX: 50, clientY: 50 } as PointerEvent); await flush();
  };
  return { onSubmit, drag, canvas };
}
it('recovers from synchronously throwing transport and preserves comment for retry', async () => {
  const submit = vi.fn().mockImplementationOnce(() => { throw new Error('Destination offline'); }).mockResolvedValue(undefined);
  const { drag } = setup(submit); await drag();
  const comment = document.querySelector('textarea')!; comment.value = 'Keep this comment';
  button('Send image + comment').click(); await flush();
  expect(document.querySelector('[role="status"]')?.textContent).toBe('Destination offline');
  expect(button('Send image + comment').disabled).toBe(false); expect(comment.value).toBe('Keep this comment');
  button('Send image + comment').click(); await flush();
  expect(submit).toHaveBeenLastCalledWith(expect.objectContaining({ comment: 'Keep this comment', width: 40, height: 40 })); expect(ui!.isOpen()).toBe(false);
});
it('never submits when Retake or Cancel is chosen', async () => {
  const { drag, onSubmit } = setup(); await drag(); document.querySelector('textarea')!.value = 'Unsent';
  expect(onSubmit).not.toHaveBeenCalled(); button('Retake').click(); expect(document.querySelector('textarea')).toBeNull();
  expect(document.querySelector('[aria-label="Select current page region"]')).not.toBeNull(); button('Cancel').click(); expect(onSubmit).not.toHaveBeenCalled(); expect(ui!.isOpen()).toBe(false);
});
it('does not intercept ordinary paste in selection or preview comments', async () => {
  const { drag } = setup();
  const event = new Event('paste', { bubbles: true, cancelable: true }); document.querySelector('[role="dialog"]')!.dispatchEvent(event); expect(event.defaultPrevented).toBe(false);
  await drag(); const paste = new Event('paste', { bubbles: true, cancelable: true }); document.querySelector('textarea')!.dispatchEvent(paste); expect(paste.defaultPrevented).toBe(false);
});
it('keeps selection usable after encoding failure', async () => {
  const { drag, onSubmit } = setup(); vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementationOnce(() => { throw new Error('Encoding unavailable'); }).mockReturnValue('data:image/png;base64,cG5n');
  await drag(); expect(document.querySelector('[role="alert"]')?.textContent).toContain('Encoding unavailable'); expect(onSubmit).not.toHaveBeenCalled();
  await drag(); expect(document.querySelector('[aria-label="Review screenshot"]')).not.toBeNull();
});
it('cancels a pending rasterization without resurrecting preview', async () => {
  const { drag, canvas, onSubmit } = setup(); let resolve!: (canvas: HTMLCanvasElement) => void;
  vi.mocked(capturePageRegion).mockReturnValue(new Promise(r => { resolve = r; })); await drag(); button('Cancel').click(); resolve(canvas); await flush();
  expect(ui!.isOpen()).toBe(false); expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(onSubmit).not.toHaveBeenCalled();
});
