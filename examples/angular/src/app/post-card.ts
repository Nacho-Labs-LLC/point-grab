import { Component, computed, input, signal } from '@angular/core';

export type DemoPost = {
  id: number;
  name: string;
  handle: string;
  role: string;
  time: string;
  text: string;
  likes: number;
  replies: number;
  accent: string;
};

@Component({
  selector: 'app-post-card',
  standalone: true,
  template: `
    <article class="post-card">
      <div class="avatar" [style.background]="post().accent">{{ initials() }}</div>

      <div class="post-body">
        <div class="post-header">
          <div>
            <div class="post-name-row">
              <strong>{{ post().name }}</strong>
              <span>{{ post().handle }}</span>
              <span>·</span>
              <span>{{ post().time }}</span>
            </div>
            <div class="post-role">{{ post().role }}</div>
          </div>

          <button class="ghost-btn" type="button" (click)="expanded.set(!expanded())">
            {{ expanded() ? 'Collapse' : 'Inspectable detail' }}
          </button>
        </div>

        <p class="post-copy">{{ post().text }}</p>

        @if (expanded()) {
          <div class="detail-panel">
            <div>
              <span class="detail-label">Component</span>
              <strong>PostCardComponent</strong>
            </div>
            <div>
              <span class="detail-label">Intent</span>
              <strong>Useful nested DOM for Angular capture</strong>
            </div>
          </div>
        }

        <div class="post-actions">
          <button type="button" class="action-btn" (click)="liked.set(!liked())">
            <span>{{ liked() ? '♥' : '♡' }}</span>
            <span>{{ likeCount() }}</span>
          </button>
          <button type="button" class="action-btn secondary">
            <span>↩</span>
            <span>{{ post().replies }}</span>
          </button>
          <button type="button" class="action-btn secondary">Open thread</button>
        </div>
      </div>
    </article>
  `,
  styles: `
    :host {
      display: block;
    }

    .post-card {
      display: grid;
      grid-template-columns: 48px minmax(0, 1fr);
      gap: 16px;
      padding: 20px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 20px;
      background: rgba(15, 23, 42, 0.72);
      box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18);
      backdrop-filter: blur(16px);
    }

    .avatar {
      width: 48px;
      height: 48px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      color: white;
      font-weight: 700;
      letter-spacing: 0.04em;
    }

    .post-body {
      display: grid;
      gap: 14px;
      min-width: 0;
    }

    .post-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }

    .post-name-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      color: #cbd5e1;
      font-size: 0.95rem;
    }

    .post-name-row strong {
      color: #f8fafc;
      font-size: 1rem;
    }

    .post-role {
      margin-top: 4px;
      color: #8ba4d4;
      font-size: 0.84rem;
    }

    .ghost-btn,
    .action-btn {
      border: 0;
      border-radius: 999px;
      cursor: pointer;
      transition:
        transform 160ms ease,
        background 160ms ease,
        color 160ms ease;
    }

    .ghost-btn:hover,
    .action-btn:hover {
      transform: translateY(-1px);
    }

    .ghost-btn {
      padding: 10px 14px;
      background: rgba(99, 102, 241, 0.16);
      color: #c7d2fe;
      font-size: 0.85rem;
      white-space: nowrap;
    }

    .post-copy {
      margin: 0;
      color: #e2e8f0;
      line-height: 1.65;
    }

    .detail-panel {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      padding: 14px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 16px;
      background: rgba(30, 41, 59, 0.75);
    }

    .detail-label {
      display: block;
      margin-bottom: 6px;
      color: #8ba4d4;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .detail-panel strong {
      color: #f8fafc;
      font-size: 0.95rem;
    }

    .post-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.18), rgba(34, 211, 238, 0.18));
      color: #f8fafc;
      font-weight: 600;
    }

    .action-btn.secondary {
      background: rgba(148, 163, 184, 0.12);
      color: #cbd5e1;
      font-weight: 500;
    }

    @media (max-width: 720px) {
      .post-card {
        grid-template-columns: 1fr;
      }

      .post-header,
      .detail-panel {
        grid-template-columns: 1fr;
        display: grid;
      }
    }
  `,
})
export class PostCardComponent {
  readonly post = input.required<DemoPost>();
  readonly liked = signal(false);
  readonly expanded = signal(false);
  readonly initials = computed(() =>
    this.post()
      .name.split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
  );
  readonly likeCount = computed(() => this.post().likes + (this.liked() ? 1 : 0));
}
