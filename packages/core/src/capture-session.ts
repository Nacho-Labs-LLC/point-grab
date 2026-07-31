import type { Annotation, ElementContext } from './types';

/**
 * Owns the lifecycle of one user-visible capture session. It deliberately has
 * no DOM or clipboard knowledge so the interaction can be tested separately
 * from presentation and transport.
 */
export interface CaptureSession {
  start(): void;
  skip(): void;
  accept(context: ElementContext, comment: string): void;
  end(): Annotation[];
  remove(index: number): Annotation | undefined;
  updateComment(index: number, comment: string): void;
  isActive(): boolean;
  getAnnotations(): readonly Annotation[];
}

export function createCaptureSession(): CaptureSession {
  let active = false;
  let annotations: Annotation[] = [];

  return {
    start(): void {
      active = true;
      annotations = [];
    },

    skip(): void {
      // A skipped target is intentionally not an annotation and does not
      // terminate the capture session.
    },

    accept(context: ElementContext, comment: string): void {
      if (!active) return;
      annotations.push({ context, comment });
    },

    end(): Annotation[] {
      const completed = [...annotations];
      active = false;
      annotations = [];
      return completed;
    },

    remove(index: number): Annotation | undefined {
      if (!active || index < 0 || index >= annotations.length) return undefined;
      return annotations.splice(index, 1)[0];
    },

    updateComment(index: number, comment: string): void {
      if (!active || index < 0 || index >= annotations.length) return;
      annotations[index] = { ...annotations[index], comment };
    },

    isActive(): boolean {
      return active;
    },

    getAnnotations(): readonly Annotation[] {
      return annotations;
    },
  };
}
