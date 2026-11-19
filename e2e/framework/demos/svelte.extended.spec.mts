/** Supplemental Svelte UI contracts: Markdown text editing and in-tab note retention. */
import { test, expect, openApp } from '../fixtures.mts';
import { checkpoint } from '../../checkpoint';

test.beforeEach(async ({ page, errors }) => { void errors; await openApp(page); });

const selectedFormats = [
  { name: 'Italic', expected: 'before _selected words_ after' },
  { name: 'Heading', expected: 'before # selected words after' },
  { name: 'Link', expected: 'before [selected words](https://example.com) after' },
] as const;

for (const { name, expected } of selectedFormats) {
  test(`formatting: ${name} wraps the selected range without losing surrounding text`, async ({ page }) => {
    const body = page.getByLabel('Note body');
    const toggle = page.locator('.toggle-format-btn');
    const formatting = page.getByRole('group', { name: 'Markdown formatting', exact: true });
    await body.fill('before selected words after');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(formatting).toHaveCount(0);
    await toggle.click();
    await expect(toggle).toHaveText('Hide toolbar');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(formatting).toBeVisible();
    await body.focus();
    // Native textarea selection only: product state still changes through the real toolbar.
    await body.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(7, 21));
    await formatting.getByRole('button', { name, exact: true }).click();
    await expect(body).toHaveValue(expected);
    await expect(body).toBeFocused();
    await expect(page.getByTestId('note-card').first().locator('.note-snippet')).toHaveText(expected);
    await checkpoint(page, `svelte-selected-${name.toLowerCase()}-markdown-result`);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toHaveText('Format ↓');
    await expect(formatting).toHaveCount(0);
    await expect(body).toHaveValue(expected);
    await checkpoint(page, `svelte-${name.toLowerCase()}-toolbar-closed-content-retained`);
    test.info().annotations.push({ type: 'demo-complete', description: `${name} selected-text Markdown, surrounding text retention, editor focus return and formatting toolbar close. No rendered-Markdown preview is offered.` });
  });
}

const placeholderFormats = [
  { name: 'Bold', expected: 'left **text** right' },
  { name: 'Italic', expected: 'left _text_ right' },
  { name: 'Heading', expected: 'left # text right' },
  { name: 'Link', expected: 'left [text](https://example.com) right' },
] as const;

for (const { name, expected } of placeholderFormats) {
  test(`formatting: ${name} inserts the no-selection placeholder at the caret`, async ({ page }) => {
    const body = page.getByLabel('Note body');
    await body.fill('left  right');
    await page.locator('.toggle-format-btn').click();
    const formatting = page.getByRole('group', { name: 'Markdown formatting', exact: true });
    await expect(formatting).toBeVisible();
    await body.focus();
    await body.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(5, 5));
    await formatting.getByRole('button', { name, exact: true }).click();
    await expect(body).toHaveValue(expected);
    await expect(body).toBeFocused();
    await expect(page.getByTestId('note-card').first().locator('.note-snippet')).toHaveText(expected);
    await checkpoint(page, `svelte-no-selection-${name.toLowerCase()}-placeholder-at-caret`);
    test.info().annotations.push({ type: 'demo-complete', description: `${name} collapsed-selection text placeholder inserted at an interior caret with surrounding text preserved.` });
  });
}

test('notes: edited title and body survive switching; update indicator returns to in-tab status', async ({ page }) => {
  const title = page.getByLabel('Note title');
  const body = page.getByLabel('Note body');
  // This is a local timer indicator, not a save request or durable persistence contract.
  const status = page.locator('.session-status');
  const cards = page.getByTestId('note-card');
  await expect(status).toHaveText('In this tab only');
  await expect(title).toHaveValue('Product launch checklist');
  await title.fill('Launch edits retained');
  await body.fill('First note edited body\nKeep this second line');
  await expect(title).toHaveValue('Launch edits retained');
  await expect(body).toHaveValue('First note edited body\nKeep this second line');
  await expect(cards.nth(0).locator('.note-title-preview')).toHaveText('Launch edits retained');
  await expect(cards.nth(0).locator('.note-snippet')).toHaveText('First note edited body');
  await expect(status).toHaveText('Updating…');
  await checkpoint(page, 'svelte-note-edits-updating-in-tab');
  await expect(status).toHaveText('In this tab only');
  await checkpoint(page, 'svelte-note-update-settled-not-durable-save');

  await cards.nth(1).click();
  await expect(cards.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(title).toHaveValue('Weekend reading');
  await expect(body).toHaveValue('The Pragmatic Programmer — chapter 4\nCheck Hacker News discussion');
  await title.fill('Reading edits retained');
  await body.fill('Second note separate body');
  await expect(cards.nth(1).locator('.note-title-preview')).toHaveText('Reading edits retained');
  await expect(cards.nth(1).locator('.note-snippet')).toHaveText('Second note separate body');
  await expect(status).toHaveText('In this tab only');
  await checkpoint(page, 'svelte-second-note-title-and-body-edited');

  await cards.nth(0).click();
  await expect(cards.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(cards.nth(1)).toHaveAttribute('aria-pressed', 'false');
  await expect(title).toHaveValue('Launch edits retained');
  await expect(body).toHaveValue('First note edited body\nKeep this second line');
  await checkpoint(page, 'svelte-first-note-title-and-multiline-body-retained');

  await cards.nth(1).click();
  await expect(cards.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(cards.nth(0)).toHaveAttribute('aria-pressed', 'false');
  await expect(title).toHaveValue('Reading edits retained');
  await expect(body).toHaveValue('Second note separate body');
  await checkpoint(page, 'svelte-second-note-title-and-body-retained-after-roundtrip');
  test.info().annotations.push({ type: 'demo-complete', description: 'Two independently edited titles/bodies retained across note switches and real Updating… → In this tab only indicator. Notes are memory-only; no Saved state or durable persistence exists.' });
});
