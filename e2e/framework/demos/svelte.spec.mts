/** Svelte playground: a notes app with search, live word count and markdown formatting. */
import { test, expect, openApp, grab } from '../fixtures.mts';

test.beforeEach(async ({ page, errors }) => { void errors; await openApp(page); });

test('notes: search, create, edit with live word count, and format', async ({ page }) => {
  const search = page.getByLabel('Search notes');
  await search.fill('pragmatic');
  await expect(page.getByTestId('note-card')).toHaveCount(1);
  await expect(page.getByTestId('note-card')).toContainText('Weekend reading');
  await search.fill('nothing matches this');
  await expect(page.getByTestId('note-card')).toHaveCount(0);

  await page.getByRole('button', { name: '+ New Note', exact: true }).click();
  await expect(search).toHaveValue('');
  await expect(page.getByTestId('note-card')).toHaveCount(4);
  await expect(page.getByTestId('note-card').first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.word-count')).toHaveText('0 words');

  const body = page.getByLabel('Note body');
  await body.fill('one');
  await expect(page.locator('.word-count')).toHaveText('1 word');
  await body.fill('ship the demo');
  await expect(page.locator('.word-count')).toHaveText('3 words');

  await page.locator('.toggle-format-btn').click();
  await body.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(5, 8));
  await page.getByRole('button', { name: 'Bold' }).click();
  await expect(body).toHaveValue('ship **the** demo');

  await page.getByTestId('note-card').nth(1).click();
  await expect(page.getByLabel('Note title')).toHaveValue('Product launch checklist');
});

test('a grab of the live word count reflects the edit and resolves App.svelte', async ({ page }) => {
  await page.getByLabel('Note body').fill('four short words here');
  // Hold-to-grab is ignored while a text field has focus, so typing shortcuts keep working.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const snippet = await grab(page, page.locator('.word-count'));
  expect(snippet).toContain('4 words');
  expect(snippet).toMatch(/^in App at src\/App\.svelte:\d+:\d+$/m);
});
