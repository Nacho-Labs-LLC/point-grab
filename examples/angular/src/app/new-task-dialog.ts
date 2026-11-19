import { Component, output, signal } from '@angular/core';
import { PEOPLE, type Priority } from './board';

export interface NewTask { title: string; priority: Priority; label: string; assignee: number }

@Component({
  selector: 'app-new-task-dialog',
  template: `
    <div class="backdrop" (click)="cancel.emit()"></div>
    <form class="dialog" role="dialog" aria-label="New task" (submit)="submit($event, title.value, priority.value, label.value, assignee.value)">
      <h2>New task</h2>
      <label>Title <input #title aria-label="New task title" placeholder="What needs doing?" maxlength="80" /></label>
      @if (error()) { <p class="error" role="alert">Give the task a title.</p> }
      <div class="row">
        <label>Priority
          <select #priority aria-label="Priority"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option></select>
        </label>
        <label>Assignee
          <select #assignee aria-label="Assignee">@for (p of people; track p.name) { <option [value]="$index">{{ p.name }}</option> }</select>
        </label>
      </div>
      <label>Label <input #label aria-label="Label" placeholder="checkout" maxlength="20" /></label>
      <div class="actions">
        <button type="button" class="secondary" (click)="cancel.emit()">Cancel</button>
        <button type="submit" class="primary">Create task</button>
      </div>
    </form>
  `,
  styles: `
    .backdrop { position: fixed; inset: 0; background: rgba(2, 6, 23, 0.6); z-index: 10; }
    .dialog { position: fixed; z-index: 11; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(440px, calc(100vw - 32px)); padding: 22px; border-radius: 18px; background: #0b1428; border: 1px solid rgba(148, 163, 184, 0.2); display: grid; gap: 14px; }
    h2 { margin: 0; color: #f8fafc; font-size: 1.1rem; }
    label { display: grid; gap: 6px; color: #94a3b8; font-size: 0.8rem; }
    input, select { padding: 9px 11px; border-radius: 10px; border: 1px solid rgba(148, 163, 184, 0.2); background: #020617; color: #f8fafc; font: inherit; font-size: 0.92rem; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .error { margin: -6px 0 0; color: #fca5a5; font-size: 0.82rem; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; }
    button { padding: 9px 14px; border-radius: 10px; font: inherit; font-weight: 600; cursor: pointer; }
    .secondary { border: 1px solid rgba(148, 163, 184, 0.25); background: transparent; color: #e2e8f0; }
    .primary { border: 0; background: #3b82f6; color: white; }
  `,
})
export class NewTaskDialogComponent {
  readonly create = output<NewTask>();
  readonly cancel = output<void>();
  protected readonly people = PEOPLE;
  protected readonly error = signal(false);
  protected submit(event: Event, title: string, priority: string, label: string, assignee: string) {
    event.preventDefault();
    if (!title.trim()) { this.error.set(true); return; }
    this.create.emit({ title: title.trim(), priority: priority as Priority, label: label.trim(), assignee: Number(assignee) });
  }
}
