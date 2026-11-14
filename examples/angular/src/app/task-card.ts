import { Component, computed, input, output } from '@angular/core';
import { nextStatus, statusTitle, type Task } from './board';

@Component({
  selector: 'app-task-card',
  template: `
    <article class="task-card" [class.selected]="selected()" [attr.data-priority]="task().priority">
      <div class="task-top">
        <span class="priority"><span class="priority-dot"></span>{{ task().priority }}</span>
        <span class="assignee" [style.background]="task().assignee.color" [title]="task().assignee.name">{{ task().assignee.initials }}</span>
      </div>
      <button type="button" class="task-title" [attr.aria-label]="'Open ' + task().title" (click)="open.emit(task().id)">{{ task().title }}</button>
      <div class="labels">
        @for (label of task().labels; track label) { <span class="label">{{ label }}</span> }
      </div>
      <div class="task-foot">
        <span class="progress" [class.complete]="doneCount() === task().checklist.length">✓ {{ doneCount() }}/{{ task().checklist.length }}</span>
        <span class="moves">
          @if (prev(); as p) {
            <button type="button" class="move" [attr.aria-label]="'Move ' + task().title + ' to ' + title(p)" (click)="move.emit({ id: task().id, dir: -1 })">←</button>
          }
          @if (next(); as n) {
            <button type="button" class="move" [attr.aria-label]="'Move ' + task().title + ' to ' + title(n)" (click)="move.emit({ id: task().id, dir: 1 })">→</button>
          }
        </span>
      </div>
    </article>
  `,
  styles: `
    :host { display: block; }
    .task-card { padding: 14px; border-radius: 14px; background: #111c33; border: 1px solid rgba(148, 163, 184, 0.14); transition: border-color 0.15s ease, transform 0.15s ease; }
    .task-card:hover { border-color: rgba(147, 197, 253, 0.4); transform: translateY(-1px); }
    .task-card.selected { border-color: #60a5fa; box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.18); }
    .task-top, .task-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .priority { display: inline-flex; align-items: center; gap: 6px; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; }
    .priority-dot { width: 8px; height: 8px; border-radius: 50%; background: #64748b; }
    [data-priority='high'] .priority-dot { background: #f87171; }
    [data-priority='medium'] .priority-dot { background: #fbbf24; }
    [data-priority='low'] .priority-dot { background: #34d399; }
    .assignee { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-size: 0.68rem; font-weight: 700; color: white; }
    .task-title { all: unset; display: block; margin: 10px 0; color: #f1f5f9; font-weight: 600; line-height: 1.35; cursor: pointer; }
    .task-title:hover { color: #93c5fd; }
    .task-title:focus-visible { outline: 2px solid #60a5fa; outline-offset: 3px; border-radius: 4px; }
    .labels { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .label { font-size: 0.72rem; padding: 2px 8px; border-radius: 999px; background: rgba(96, 165, 250, 0.12); color: #bfdbfe; }
    .progress { font-size: 0.78rem; color: #94a3b8; }
    .progress.complete { color: #34d399; }
    .moves { display: flex; gap: 6px; }
    .move { width: 28px; height: 28px; border-radius: 8px; border: 1px solid rgba(148, 163, 184, 0.2); background: transparent; color: #cbd5e1; cursor: pointer; }
    .move:hover { background: rgba(148, 163, 184, 0.12); }
  `,
})
export class TaskCardComponent {
  readonly task = input.required<Task>();
  readonly selected = input(false);
  readonly open = output<number>();
  readonly move = output<{ id: number; dir: -1 | 1 }>();
  protected readonly doneCount = computed(() => this.task().checklist.filter((c) => c.done).length);
  protected readonly prev = computed(() => nextStatus(this.task().status, -1));
  protected readonly next = computed(() => nextStatus(this.task().status, 1));
  protected readonly title = statusTitle;
}
