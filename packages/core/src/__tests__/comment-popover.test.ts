// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCommentPopover } from '../toolbar/comment-popover';

describe('capture-session comment dialog', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>';
  });

  it('offers Skip alongside Accept while a capture session is active', () => {
    const popover = createCommentPopover({
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
    });

    popover.show('multi');

    expect(document.querySelector('[aria-label="Add comment"]')).not.toBeNull();
    expect(document.querySelector('.point-grab-comment-cancel')?.textContent).toBe('Skip');
    expect(document.querySelector('.point-grab-comment-submit')?.textContent).toBe('Accept');
  });
});
