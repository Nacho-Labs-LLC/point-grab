import { Component } from '@angular/core';
import { PostCardComponent, type DemoPost } from './post-card';
import { StatCardComponent } from './stat-card';

const METRICS = [
  {
    label: 'Selection latency',
    value: '42ms',
    hint: 'Hold Ctrl+C / Cmd+C, hover any element, and click to capture context.',
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
export class App {
  protected readonly metrics = METRICS;
  protected readonly posts = POSTS;
}
