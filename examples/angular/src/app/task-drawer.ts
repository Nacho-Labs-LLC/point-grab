import { Component, computed, input, output } from '@angular/core';
import { STATUSES, type Status, type Task } from './board';

@Component({
  selector: 'app-task-drawer',
  template: `
    <aside class="drawer" role="dialog" aria-label="Task details" data-testid="task-drawer">
      <div class="drawer-head">
        <span class="eyebrow">Task #{{ task().id }}</span>
        <button type="button" class="close" aria-label="Close task details" (click)="close.emit()">✕</button>
      </div>
      <label class="field">Title
        <input [value]="task().title" (change)="rename.emit({ id: task().id, title: $any($event.target).value })" aria-label="Task title" />
      </label>
      <label class="field">Status
        <select [value]="task().status" (change)="setStatus.emit({ id: task().id, status: $any($event.target).value })" aria-label="Task status">
          @for (s of statuses; track s.id) { <option [value]="s.id" [selected]="s.id === task().status">{{ s.title }}</option> }
        </select>
      </label>
      <div class="checklist">
        <div class="checklist-head"><span>Checklist</span><span data-testid="checklist-progress">{{ percent() }}%</span></div>
        <div class="bar"><span [style.width.%]="percent()"></span></div>
        @for (item of task().checklist; track $index) {
          <label class="check"><input type="checkbox" [checked]="item.done" (change)="toggle.emit({ id: task().id, index: $index })" /> <span [class.done]="item.done">{{ item.text }}</span></label>
        }
      </div>
      <p class="assignee">Assigned to <strong>{{ task().assignee.name }}</strong></p>
    </aside>
  `,
  styles: `
    .drawer { position: sticky; top: 20px; padding: 20px; border-radius: 18px; background: #0b1428; border: 1px solid rgba(96, 165, 250, 0.3); box-shadow: 0 20px 50px rgba(2, 6, 23, 0.5); }
    .drawer-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .eyebrow { color: #93c5fd; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
    .close { border: 0; background: rgba(148, 163, 184, 0.12); color: #e2e8f0; width: 30px; height: 30px; border-radius: 8px; cursor: pointer; }
    .field { display: grid; gap: 6px; margin-bottom: 14px; color: #94a3b8; font-size: 0.8rem; }
    input:not([type]), select { padding: 9px 11px; border-radius: 10px; border: 1px solid rgba(148, 163, 184, 0.2); background: #020617; color: #f8fafc; font: inherit; font-size: 0.92rem; }
    .checklist-head { display: flex; justify-content: space-between; color: #cbd5e1; font-size: 0.85rem; font-weight: 600; }
    .bar { height: 6px; margin: 8px 0 12px; border-radius: 999px; background: rgba(148, 163, 184, 0.15); overflow: hidden; }
    .bar span { display: block; height: 100%; background: linear-gradient(90deg, #60a5fa, #34d399); transition: width 0.3s ease; }
    .check { display: flex; gap: 10px; align-items: center; padding: 6px 0; color: #e2e8f0; font-size: 0.9rem; cursor: pointer; }
    .check .done { color: #64748b; text-decoration: line-through; }
    .assignee { margin: 14px 0 0; color: #94a3b8; font-size: 0.85rem; }
    .assignee strong { color: #e2e8f0; }
  `,
})
export class TaskDrawerComponent {
  readonly task = input.required<Task>();
  readonly close = output<void>();
  readonly rename = output<{ id: number; title: string }>();
  readonly setStatus = output<{ id: number; status: Status }>();
  readonly toggle = output<{ id: number; index: number }>();
  protected readonly statuses = STATUSES;
  protected readonly percent = computed(() => {
    const list = this.task().checklist;
    return list.length ? Math.round((list.filter((c) => c.done).length / list.length) * 100) : 0;
  });
}
