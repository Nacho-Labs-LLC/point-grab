import { Component, input, output } from '@angular/core';
import { TaskCardComponent } from './task-card';
import type { Status, Task } from './board';

@Component({
  selector: 'app-board-column',
  imports: [TaskCardComponent],
  template: `
    <section class="column" [attr.aria-label]="title()" [attr.data-status]="status()">
      <header>
        <h3>{{ title() }}</h3>
        <span class="count" data-testid="column-count">{{ tasks().length }}</span>
      </header>
      <div class="cards">
        @for (task of tasks(); track task.id) {
          <app-task-card [task]="task" [selected]="task.id === selectedId()" (open)="open.emit($event)" (move)="move.emit($event)" />
        } @empty {
          <p class="empty">Nothing here{{ filtered() ? ' matches your filter' : ' yet' }}.</p>
        }
      </div>
    </section>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .column { padding: 14px; border-radius: 18px; background: rgba(15, 23, 42, 0.72); border: 1px solid rgba(148, 163, 184, 0.12); min-height: 260px; }
    header { display: flex; align-items: center; justify-content: space-between; margin: 2px 4px 12px; }
    h3 { margin: 0; font-size: 0.85rem; letter-spacing: 0.06em; text-transform: uppercase; color: #cbd5e1; }
    .count { min-width: 24px; padding: 2px 8px; border-radius: 999px; text-align: center; font-size: 0.78rem; font-weight: 700; background: rgba(148, 163, 184, 0.14); color: #e2e8f0; }
    .cards { display: grid; gap: 10px; }
    .empty { margin: 24px 0; text-align: center; color: #64748b; font-size: 0.88rem; }
  `,
})
export class BoardColumnComponent {
  readonly status = input.required<Status>();
  readonly title = input.required<string>();
  readonly tasks = input.required<Task[]>();
  readonly selectedId = input<number | null>(null);
  readonly filtered = input(false);
  readonly open = output<number>();
  readonly move = output<{ id: number; dir: -1 | 1 }>();
}
