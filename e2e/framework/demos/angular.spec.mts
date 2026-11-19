/** Angular playground: a sprint board with a task drawer, filters and a create dialog. */
import { test, expect, openApp, grab } from '../fixtures.mts';
import { checkpoint } from '../../checkpoint';

test.beforeEach(async ({ page, errors }) => { void errors; await openApp(page); });

const count = (page: import('@playwright/test').Page, column: number) =>
  page.locator('app-board-column').nth(column).getByTestId('column-count');

test('board: drawer checklist, status and rename update the board and stats', async ({ page }) => {
  await page.getByRole('button', { name: 'Open Redesign the order summary' }).click();
  const drawer = page.getByTestId('task-drawer');
  await expect(drawer).toBeVisible();
  await expect(drawer.getByTestId('checklist-progress')).toHaveText('33%');
  await drawer.getByRole('checkbox').nth(1).check();
  await expect(drawer.getByTestId('checklist-progress')).toHaveText('67%');
  await checkpoint(page, 'task-drawer-checklist-updated');

  await expect(page.getByTestId('done-count')).toHaveText('1');
  await drawer.getByLabel('Task status').selectOption('done');
  await expect(page.getByTestId('done-count')).toHaveText('2');
  await expect(count(page, 2)).toHaveText('2');
  await checkpoint(page, 'task-status-updated-board-and-stats');

  await drawer.getByLabel('Task title').fill('Redesign the order total');
  await drawer.getByLabel('Task title').press('Enter');
  await expect(page.getByRole('button', { name: 'Open Redesign the order total' })).toBeVisible();
  await checkpoint(page, 'task-renamed-in-live-board');
  await drawer.getByRole('button', { name: 'Close task details' }).click();
  await expect(drawer).toHaveCount(0);
});

test('board: create a task, then search and priority filters narrow the board', async ({ page }) => {
  await page.getByRole('button', { name: '+ New task' }).click();
  await page.getByLabel('New task title').fill('Receipt email template');
  await page.getByRole('dialog', { name: 'New task' }).getByLabel('Priority').selectOption('high');
  await page.getByRole('button', { name: 'Create task' }).click();
  await expect(count(page, 0)).toHaveText('3');
  await expect(page.locator('app-task-card')).toHaveCount(6);
  await checkpoint(page, 'task-created-high-priority');

  await page.getByLabel('Search tasks').fill('receipt');
  await expect(page.locator('app-task-card')).toHaveCount(1);
  await page.getByLabel('Search tasks').fill('');
  await page.getByRole('group', { name: 'Filter by priority' }).getByRole('button', { name: 'high' }).click();
  await expect(page.locator('app-task-card')).toHaveCount(2);
  await checkpoint(page, 'task-priority-filter-result');
});

test('a grab inside the task drawer resolves TaskDrawerComponent under App', async ({ page }) => {
  await page.getByRole('button', { name: 'Open Promo banner copy' }).click();
  const snippet = await grab(page, page.getByTestId('checklist-progress'));
  expect(snippet).toContain('50%');
  expect(snippet).toMatch(/^in TaskDrawerComponent$/m);
  expect(snippet).toMatch(/^in App$/m);
});
