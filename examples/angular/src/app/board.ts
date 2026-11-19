export type Status = 'todo' | 'doing' | 'done';
export type Priority = 'low' | 'medium' | 'high';

export interface Person { name: string; initials: string; color: string }
export interface ChecklistItem { text: string; done: boolean }
export interface Task {
  id: number;
  title: string;
  status: Status;
  priority: Priority;
  labels: string[];
  assignee: Person;
  checklist: ChecklistItem[];
}

export const STATUSES: { id: Status; title: string }[] = [
  { id: 'todo', title: 'To do' },
  { id: 'doing', title: 'In progress' },
  { id: 'done', title: 'Done' },
];

export const PEOPLE: Person[] = [
  { name: 'Mia Chen', initials: 'MC', color: '#8b5cf6' },
  { name: 'Dev Patel', initials: 'DP', color: '#0ea5e9' },
  { name: 'Rosa Lin', initials: 'RL', color: '#f59e0b' },
];

export const SEED_TASKS: Task[] = [
  { id: 1, title: 'Redesign the order summary', status: 'doing', priority: 'high', labels: ['checkout', 'design'], assignee: PEOPLE[0],
    checklist: [{ text: 'Audit current layout', done: true }, { text: 'Mobile breakpoints', done: false }, { text: 'Ship behind a flag', done: false }] },
  { id: 2, title: 'Apple Pay on the payment step', status: 'todo', priority: 'medium', labels: ['payments'], assignee: PEOPLE[1],
    checklist: [{ text: 'Merchant validation', done: false }, { text: 'Fallback to card form', done: false }] },
  { id: 3, title: 'Inline address validation', status: 'todo', priority: 'low', labels: ['checkout'], assignee: PEOPLE[2],
    checklist: [{ text: 'Pick a geocoding provider', done: false }] },
  { id: 4, title: 'Fix coupon field focus ring', status: 'done', priority: 'low', labels: ['a11y'], assignee: PEOPLE[0],
    checklist: [{ text: 'Contrast check', done: true }] },
  { id: 5, title: 'Promo banner copy', status: 'doing', priority: 'medium', labels: ['content'], assignee: PEOPLE[2],
    checklist: [{ text: 'Draft three options', done: true }, { text: 'Legal review', done: false }] },
];

export const nextStatus = (status: Status, dir: -1 | 1): Status | null => {
  const index = STATUSES.findIndex((s) => s.id === status) + dir;
  return STATUSES[index]?.id ?? null;
};
export const statusTitle = (status: Status) => STATUSES.find((s) => s.id === status)!.title;
