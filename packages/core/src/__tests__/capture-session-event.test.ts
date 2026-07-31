// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createCaptureSessionEventDetail } from '../grab';
import type { Annotation, ElementContext } from '../types';

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

describe('capture-session event detail', () => {
  it('includes the selected target and a stable annotation snapshot', () => {
    const target = makeContext('Save');
    const annotations: Annotation[] = [{ context: target, comment: 'Make this prominent.' }];

    const detail = createCaptureSessionEventDetail('accepted', annotations, target);

    expect(detail).toEqual({ action: 'accepted', annotationCount: 1, annotations, target });
    expect(detail.annotations).not.toBe(annotations);
  });
});
