// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createCaptureSession } from '../capture-session';
import type { ElementContext } from '../types';

function makeContext(label: string): ElementContext {
  const element = document.createElement('button');
  element.textContent = label;
  return {
    element,
    html: `<button>${label}</button>`,
    componentName: null,
    filePath: null,
    line: null,
    column: null,
    componentStack: [],
    selector: `button[data-label="${label}"]`,
    cssClasses: [],
    textContent: label,
    ariaLabel: null,
    role: 'button',
    elementDescription: `Button: ${label}`,
  };
}

describe('capture session', () => {
  it('keeps an empty session active when the user skips a selected element', () => {
    const session = createCaptureSession();

    session.start();
    session.skip();

    expect(session.isActive()).toBe(true);
    expect(session.getAnnotations()).toEqual([]);
  });

  it('accumulates ordered annotated elements until the user ends capture mode', () => {
    const session = createCaptureSession();
    const first = makeContext('Save');
    const second = makeContext('Delete');

    session.start();
    session.accept(first, 'Make this less prominent.');
    session.accept(second, 'Add a confirmation step.');

    expect(session.getAnnotations()).toEqual([
      { context: first, comment: 'Make this less prominent.' },
      { context: second, comment: 'Add a confirmation step.' },
    ]);
    expect(session.end()).toEqual([
      { context: first, comment: 'Make this less prominent.' },
      { context: second, comment: 'Add a confirmation step.' },
    ]);
    expect(session.isActive()).toBe(false);
    expect(session.getAnnotations()).toEqual([]);
  });

  it('renumbers the session source of truth after deleting a capture and can edit the remaining comment', () => {
    const session = createCaptureSession();
    const first = makeContext('Save');
    const second = makeContext('Delete');
    const third = makeContext('Publish');

    session.start();
    session.accept(first, 'First');
    session.accept(second, 'Second');
    session.accept(third, 'Third');
    expect(session.remove(1)?.comment).toBe('Second');
    session.updateComment(1, 'Updated third');

    expect(session.getAnnotations().map((annotation) => annotation.comment)).toEqual(['First', 'Updated third']);
  });
});
