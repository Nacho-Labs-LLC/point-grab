// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copyAnnotationsAsPrompt, copyWithComment } from '../toolbar/copy-actions';
import type { Annotation, ElementContext } from '../types';

function makeContext(overrides: Partial<ElementContext> = {}): ElementContext {
  const element = document.createElement('button');
  element.className = 'btn-primary';
  element.textContent = 'Submit Order';
  return {
    element,
    html: '<button class="btn-primary">Submit Order</button>',
    componentName: 'SubmitButton',
    filePath: 'src/components/SubmitButton.tsx',
    line: 24,
    column: 3,
    componentStack: [{ name: 'CheckoutForm', filePath: 'src/components/CheckoutForm.tsx', line: 8, column: 1 }],
    selector: 'button.btn-primary',
    cssClasses: ['btn-primary'],
    textContent: 'Submit Order',
    ariaLabel: null,
    role: 'button',
    elementDescription: 'Button: Submit Order',
    ...overrides,
  };
}

describe('comment-mode copy actions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    document.documentElement.innerHTML = '<head></head><body></body>';
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('copies a single commented grab with the appended comment', async () => {
    const context = makeContext();
    const ok = await copyWithComment(context, 'Disable this button while saving.', 20);

    expect(ok).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    const copied = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];
    expect(copied).toContain('[<button.btn-primary> (CheckoutForm at src/components/CheckoutForm.tsx:8:1)]');
    expect(copied).not.toContain('Submit Order');
    expect(copied).not.toContain('selector:');
    expect(copied).toContain('Disable this button while saving.');
    expect(copied).toContain('/* Comment: Disable this button while saving. */');
  });

  it('copies multiple reviewed elements as a single confirmed prompt', async () => {
    const annotations: Annotation[] = [
      { context: makeContext(), comment: 'Make the primary action more obvious.' },
      {
        context: makeContext({
          html: '<div class="status-pill">Syncing…</div>',
          componentName: 'StatusPill',
          filePath: 'src/components/StatusPill.tsx',
          line: 10,
          selector: 'div.status-pill',
          cssClasses: ['status-pill'],
          textContent: 'Syncing…',
          role: null,
          elementDescription: 'Status pill',
        }),
        comment: 'Change this wording to something clearer.',
      },
    ];

    const ok = await copyAnnotationsAsPrompt(annotations, 20);

    expect(ok).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    const copied = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];
    expect(copied).toContain('## Element 1');
    expect(copied).toContain('## Element 2');
    expect(copied).toContain('Make the primary action more obvious.');
    expect(copied).toContain('Change this wording to something clearer.');
    expect(copied).not.toContain('selector:');
    expect(copied).toContain('---');
  });
});
