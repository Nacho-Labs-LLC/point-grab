// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createActionsMenu } from '../toolbar/actions-menu';

describe('capture action menu', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>';
  });

  it('anchors selection actions and expands Add to Review inline', () => {
    const callbacks = { onCopyElement: vi.fn(), onCopyStyles: vi.fn(), onCopyHtml: vi.fn(), onAddToReview: vi.fn(), onCancel: vi.fn() };
    const menu = createActionsMenu(callbacks);

    menu.show({ x: 120, y: 90 });
    expect(document.querySelector('[aria-label="Selected element actions"]')).not.toBeNull();
    expect(document.querySelector('[data-point-grab-action="copy-styles"]')?.textContent).toContain('Copy Styles');

    (document.querySelector('[data-point-grab-action="add-review"]') as HTMLButtonElement).click();
    expect(document.querySelector('textarea[aria-label="Review comment"]')).not.toBeNull();
    expect(document.querySelector('[data-point-grab-action="add-batch"]')?.textContent).toContain('Add to batch');
    expect(document.querySelector('[data-point-grab-action="add-without-comment"]')?.textContent).toContain('Add without comment');
  });

  it('enforces the 500 character comment limit and submits optional comments', () => {
    const onAddToReview = vi.fn();
    const menu = createActionsMenu({ onCopyElement: vi.fn(), onCopyStyles: vi.fn(), onCopyHtml: vi.fn(), onAddToReview, onCancel: vi.fn() });
    menu.show({ x: 20, y: 20 });
    (document.querySelector('[data-point-grab-action="add-review"]') as HTMLButtonElement).click();
    const textarea = document.querySelector('textarea[aria-label="Review comment"]') as HTMLTextAreaElement;
    textarea.value = 'a'.repeat(501);
    textarea.dispatchEvent(new Event('input'));
    expect(document.querySelector('[data-point-grab-comment-count]')?.textContent).toBe('501/500');
    expect((document.querySelector('[data-point-grab-action="add-batch"]') as HTMLButtonElement).disabled).toBe(true);

    textarea.value = 'Make this clearer';
    textarea.dispatchEvent(new Event('input'));
    (document.querySelector('[data-point-grab-action="add-batch"]') as HTMLButtonElement).click();
    expect(onAddToReview).toHaveBeenCalledWith('Make this clearer');
  });
});
