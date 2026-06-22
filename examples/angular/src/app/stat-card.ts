import { Component, input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  template: `
    <section class="stat-card">
      <div class="eyebrow">{{ label() }}</div>
      <div class="value">{{ value() }}</div>
      <p>{{ hint() }}</p>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .stat-card {
      padding: 18px;
      border-radius: 18px;
      border: 1px solid rgba(148, 163, 184, 0.16);
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.82), rgba(15, 23, 42, 0.68));
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
    }

    .eyebrow {
      color: #93c5fd;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .value {
      margin-top: 10px;
      color: #f8fafc;
      font-size: clamp(1.6rem, 3vw, 2.4rem);
      font-weight: 700;
    }

    p {
      margin: 10px 0 0;
      color: #cbd5e1;
      line-height: 1.5;
      font-size: 0.92rem;
    }
  `,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly hint = input.required<string>();
}
