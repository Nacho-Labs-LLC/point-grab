import { Component, OnDestroy, signal } from '@angular/core';
import { getPointGrabApi, registerPointGrabPlugin } from '@point-grab/angular';
import { PostCardComponent, type DemoPost } from './post-card';
import { StatCardComponent } from './stat-card';

const METRICS = [
  {
    label: 'Selection latency',
    value: '42ms',
    hint: 'Toggle Ctrl+Shift+C / Cmd+Shift+C, then hover any element and click to capture context.',
  },
  {
    label: 'Resolved component',
    value: 'Angular',
    hint: 'This demo exists to prove the adapter path, not just the generic overlay.',
  },
  {
    label: 'Source fidelity',
    value: 'Dev-first',
    hint: 'Run with ng serve for the richest Angular component and source metadata.',
  },
] as const;

const POSTS: DemoPost[] = [
  {
    id: 1,
    name: 'Mia Chen',
    handle: '@mia_builds',
    role: 'Frontend engineer · design systems',
    time: '2m ago',
    text: 'Angular finally has a real point-grab demo now. This thread is intentionally component-heavy so you can inspect cards, buttons, and nested layouts instead of a toy div.',
    likes: 48,
    replies: 12,
    accent: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  },
  {
    id: 2,
    name: 'Dev Patel',
    handle: '@devpatel_hq',
    role: 'Product engineer · AI workflows',
    time: '18m ago',
    text: 'The gap before was obvious: the site proved point-grab itself, but not Angular integration. This example closes that hole with a real standalone app surface.',
    likes: 124,
    replies: 31,
    accent: 'linear-gradient(135deg, #0ea5e9, #22d3ee)',
  },
  {
    id: 3,
    name: 'Rosa Lin',
    handle: '@rosalin_dev',
    role: 'DX lead · component tooling',
    time: '45m ago',
    text: 'If you are demoing AI-assisted UI changes, give the model exact component and DOM context. That is the whole point of point-grab and why framework examples matter.',
    likes: 312,
    replies: 58,
    accent: 'linear-gradient(135deg, #f59e0b, #ef4444)',
  },
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [StatCardComponent, PostCardComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnDestroy {
  protected readonly metrics = METRICS;
  protected readonly posts = POSTS;
  protected readonly walkthroughStarted = signal(false);
  protected readonly walkthroughComplete = signal(false);
  protected readonly reviewCount = signal(0);
  protected readonly walkthroughStep = signal(1);
  protected readonly promptPreview = signal('');

  constructor() {
    window.addEventListener('point-grab:capture-session', this.handleCaptureSession);
    registerPointGrabPlugin({
      name: 'angular-guided-walkthrough',
      hooks: {
        onCopySuccess: () => {
          if (this.walkthroughStarted()) void this.syncPromptPreview();
        },
      },
    });
  }

  private readonly handleCaptureSession = (event: Event): void => {
    if (!this.walkthroughStarted()) return;
    const { action, annotationCount } = (event as CustomEvent<{ action?: string; annotationCount?: number }>).detail ?? {};

    if (action === 'accepted') {
      this.reviewCount.set(Math.min(annotationCount ?? 0, 2));
      this.walkthroughStep.set(annotationCount === 1 ? 2 : 3);
      void this.syncPromptPreview();
    } else if (action === 'skipped' && this.walkthroughStep() === 2) {
      this.walkthroughStep.set(3);
    } else if (action === 'ended') {
      this.walkthroughComplete.set(this.reviewCount() >= 2);
    }
  };

  protected startWalkthrough(): void {
    this.walkthroughStarted.set(true);
    this.walkthroughComplete.set(false);
    this.reviewCount.set(0);
    this.walkthroughStep.set(1);
    this.promptPreview.set('');
  }

  protected currentStepText(): string {
    switch (this.walkthroughStep()) {
      case 1:
        return 'review the highlighted metric';
      case 2:
        return 'skip the highlighted post copy to keep the session active';
      default:
        return 'review the highlighted operator note';
    }
  }

  private async syncPromptPreview(): Promise<void> {
    try {
      const prompt = await navigator.clipboard.readText();
      const count = (prompt.match(/^## Element /gm) ?? []).length;
      if (count > 0) {
        this.promptPreview.set(prompt);
        this.reviewCount.set(Math.min(count, 2));
      }
    } catch {
      // Clipboard reads can be denied outside a user gesture. A later accepted
      // review retries the preview without replacing the real capture flow.
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('point-grab:capture-session', this.handleCaptureSession);
    getPointGrabApi()?.unregisterPlugin('angular-guided-walkthrough');
  }
}
