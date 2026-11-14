import { Component, computed, signal } from '@angular/core';
import { BoardColumnComponent } from './board-column';
import { NewTaskDialogComponent, type NewTask } from './new-task-dialog';
import { PlaygroundGuideComponent } from './playground-guide';
import { TaskDrawerComponent } from './task-drawer';
import { PEOPLE, SEED_TASKS, STATUSES, nextStatus, type Priority, type Status, type Task } from './board';

@Component({
  selector: 'app-root',
  imports: [BoardColumnComponent, TaskDrawerComponent, NewTaskDialogComponent, PlaygroundGuideComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly statuses = STATUSES;
  protected readonly people = PEOPLE;
  protected readonly tasks = signal<Task[]>(structuredClone(SEED_TASKS));
  protected readonly query = signal('');
  protected readonly priority = signal<Priority | 'all'>('all');
  protected readonly selectedId = signal<number | null>(null);
  protected readonly creating = signal(false);

  protected readonly filtering = computed(() => !!this.query().trim() || this.priority() !== 'all');
  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.tasks().filter((t) =>
      (this.priority() === 'all' || t.priority === this.priority()) &&
      (!q || t.title.toLowerCase().includes(q) || t.labels.some((l) => l.includes(q))));
  });
  protected readonly selected = computed(() => this.tasks().find((t) => t.id === this.selectedId()) ?? null);
  protected readonly stats = computed(() => {
    const all = this.tasks();
    const done = all.filter((t) => t.status === 'done').length;
    return { total: all.length, doing: all.filter((t) => t.status === 'doing').length, done, percent: all.length ? Math.round((done / all.length) * 100) : 0 };
  });

  protected column(status: Status) { return this.visible().filter((t) => t.status === status); }

  private update(id: number, change: (task: Task) => Task) {
    this.tasks.update((list) => list.map((t) => (t.id === id ? change(t) : t)));
  }
  protected move({ id, dir }: { id: number; dir: -1 | 1 }) {
    this.update(id, (t) => ({ ...t, status: nextStatus(t.status, dir) ?? t.status }));
  }
  protected setStatus({ id, status }: { id: number; status: Status }) { this.update(id, (t) => ({ ...t, status })); }
  protected rename({ id, title }: { id: number; title: string }) { if (title.trim()) this.update(id, (t) => ({ ...t, title: title.trim() })); }
  protected toggle({ id, index }: { id: number; index: number }) {
    this.update(id, (t) => ({ ...t, checklist: t.checklist.map((c, i) => (i === index ? { ...c, done: !c.done } : c)) }));
  }
  protected create(input: NewTask) {
    const id = Math.max(0, ...this.tasks().map((t) => t.id)) + 1;
    this.tasks.update((list) => [...list, { id, title: input.title, status: 'todo', priority: input.priority, labels: input.label ? [input.label.toLowerCase()] : [], assignee: PEOPLE[input.assignee] ?? PEOPLE[0], checklist: [] }]);
    this.creating.set(false);
    this.selectedId.set(id);
  }
}
