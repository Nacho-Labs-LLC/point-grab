/** Shared real-UI journeys: selected and pending Actions, plus the supported comment queue.
 * Intentionally no Copy Classes, context-menu, review editor or item-removal fiction:
 * actions-menu.ts / grab.ts expose none. Classes belong to HTML, selectors and toast
 * details; Copy Styles exports computed declarations, not class names or stylesheet rules.
 */
import type { Locator, Page } from '@playwright/test';
import {
  test, expect, framework, profile, openApp, toolbarButton, overlay, toast,
  chooseAction, holdGrab, pick, clipboard, setClipboard,
} from './fixtures.mts';
import { checkpoint } from '../checkpoint';

const commentDialog = (page: Page) => page.getByRole('dialog', { name: 'Add comment', exact: true });
const confirm = (page: Page) => toolbarButton(page, 'copyPrompt');
// The default Solid heading has no classes. Use a genuine, class-bearing ProductCard
// button instead, while retaining the profile's adapter/source contract.
const actionTarget = (page: Page) => framework === 'solid'
  ? page.locator('.add-button').first() : profile.target(page);
const secondTarget = (page: Page) => framework === 'angular'
  ? profile.second(page).locator('.stat-label').first() : profile.second(page);
const covered = (...ids: string[]) => ids.forEach((description) =>
  test.info().annotations.push({ type: 'coverage', description }));

async function copiedText(page: Page, name: string) {
  const text = await clipboard(page);
  await test.info().attach(name, { body: text, contentType: 'text/plain' });
  return text;
}

async function settledStyles(target: Locator) {
  await expect.poll(async () => {
    const before = await styles(target);
    await target.page().waitForTimeout(100);
    return before === await styles(target);
  }, { message: 'computed export properties have settled after pointer movement' }).toBe(true);
}

async function action(page: Page, label: string, name: string, styleTarget?: Locator) {
  await toolbarButton(page, 'actions').click();
  const menu = page.getByRole('menu', { name: 'Actions', exact: true });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem')).toHaveText([
    'Copy Element', 'Copy Styles', 'Copy HTML', 'Add Comment', 'Add screenshot', 'Clear History',
  ]);
  await checkpoint(page, `${name}-actions-menu`);
  if (styleTarget) await settledStyles(styleTarget);
  await menu.getByRole('menuitem', { name: label, exact: true }).click();
}

async function hoverThenPick(page: Page, target: Locator, name: string) {
  await target.scrollIntoViewIfNeeded();
  await target.hover();
  await expect(overlay(page)).toBeVisible();
  await expect(toolbarButton(page, 'selection')).toHaveClass(/point-grab-btn-active/);
  await checkpoint(page, `${name}-hover-highlight-before-pick`);
  await settledStyles(target);
  await pick(page, target);
}

// Independent expected serialized markup from the real DOM, applying only the adapter's
// documented attribute cleaners. In particular, Svelte's class filter affects the
// selector/toast, NOT the HTML class attribute: generated svelte-* classes remain there.
async function markup(target: Locator) {
  const raw = await target.evaluate((el) => el.outerHTML);
  switch (framework) {
    case 'react': return raw.replace(/\sdata-reactroot(?:="[^"]*")?/gi, '').replace(/\sdata-reactid="[^"]*"/gi, '');
    case 'vue': return raw.replace(/\sdata-v-[a-f0-9]+(?:="[^"]*")?/gi, '');
    case 'svelte': return raw.replace(/\ssvelte-[a-z0-9]+(?:="[^"]*")?/gi, '');
    case 'angular': return raw.replace(/\s_ng(?:host|content)-[a-z0-9-]+="[^"]*"/gi, '').replace(/\s_ng(?:host|content)-[a-z0-9-]+/gi, '');
    case 'solid': return raw.replace(/\sdata-point-grab-(?:source|component)(?:="[^"]*")?/gi, '').replace(/\sdata-hk(?:="[^"]*")?/gi, '');
    default: return raw;
  }
}

async function classesAndSelector(target: Locator) {
  const { tag, id, classes } = await target.evaluate((el) => ({
    tag: el.tagName.toLowerCase(), id: el.id, classes: Array.from(el.classList),
  }));
  const kept = classes.filter((c) => framework === 'react' ? !c.startsWith('r-')
    : framework === 'svelte' ? !c.startsWith('s-') && !c.startsWith('svelte-')
    : framework === 'angular' ? !c.startsWith('ng-') && !c.startsWith('_ng') : true);
  return { classes, kept, selector: `${tag}${id ? `#${id}` : ''}${kept.map((c) => `.${c}`).join('')}` };
}

async function assertElement(page: Page, target: Locator, text: string, checkProfile = true) {
  const html = await markup(target);
  const { kept, selector } = await classesAndSelector(target);
  expect(text.startsWith(`${html}\nselector: ${selector}`)).toBe(true);
  expect(text).not.toContain('Comment:');
  if (checkProfile) for (const pattern of profile.grab.snippet) expect(text).toMatch(pattern);
  for (const c of kept) await expect(toast(page)).toContainText(`.${c}`);
  expect(text.split('\n').filter((line) => line.startsWith('selector: '))).toEqual([`selector: ${selector}`]);
}

// Exact computed-style export contract, read from the live target without invoking any
// Point Grab function. Assert the complete clipboard, including order and omitted defaults.
const STYLE_PROPERTIES = [
  'display', 'position', 'top', 'right', 'bottom', 'left',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'margin', 'padding', 'border', 'border-radius', 'background', 'background-color',
  'color', 'font', 'font-size', 'font-weight', 'font-family', 'line-height',
  'text-align', 'text-decoration', 'text-transform', 'opacity', 'overflow', 'z-index',
  'flex-direction', 'justify-content', 'align-items', 'gap',
  'grid-template-columns', 'grid-template-rows', 'box-shadow', 'cursor', 'transition', 'transform',
];
async function styles(target: Locator) {
  return target.evaluate((el, props) => {
    const tag = el.tagName.toLowerCase();
    const computed = getComputedStyle(el);
    const lines = [`/* Computed styles for <${tag}> */`, `${tag} {`];
    for (const prop of props) {
      const value = computed.getPropertyValue(prop);
      if (value && !['none', 'normal', 'auto', '0px', 'visible'].includes(value)) lines.push(`  ${prop}: ${value};`);
    }
    return [...lines, '}'].join('\n');
  }, STYLE_PROPERTIES);
}

async function referenceGrab(page: Page, target: Locator, name: string, checkProfile = false) {
  await holdGrab(page, target);
  await expect(toast(page)).toContainText('Copied to clipboard');
  const text = await copiedText(page, `${name}-actual-element-context`);
  await assertElement(page, target, text, checkProfile);
  await checkpoint(page, `${name}-copied-context-and-classes`);
  return text;
}

async function queueComment(page: Page, comment: string, count: number, name: string, initialDraft = '') {
  const dialog = commentDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox')).toHaveValue(initialDraft);
  await dialog.getByRole('textbox').fill(comment);
  await checkpoint(page, `${name}-written-before-add`);
  await dialog.getByRole('button', { name: 'Add to Review', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(toast(page)).toContainText(`Review item ${count} added`);
  await expect(confirm(page)).toHaveAccessibleName(`Confirm & Copy ${count} reviewed element${count === 1 ? '' : 's'}`);
  await expect(confirm(page).locator('.point-grab-badge')).toHaveText(String(count));
  await checkpoint(page, `${name}-queued-review-count-${count}`);
}

test.describe(`${framework} full Actions and comment journeys`, () => {
  test.beforeEach(async ({ page, errors }) => { void errors; await openApp(page); });

  for (const label of ['Copy Element', 'Copy HTML', 'Copy Styles'] as const) {
    const id = label.toLowerCase().replaceAll(' ', '-');
    test(`${label}: pending target, selected target, and replacement target produce real clipboard output`, async ({ page }) => {
      const target = actionTarget(page);
      const data = await classesAndSelector(target);
      expect(data.kept.length, 'real demo target must expose authored classes').toBeGreaterThan(0);
      await setClipboard(page, `${id}: untouched until a target is picked`);
      await action(page, label, `${id}-pending`);
      await target.hover();
      await expect(overlay(page)).toBeVisible();
      expect(await clipboard(page)).toBe(`${id}: untouched until a target is picked`);
      await hoverThenPick(page, target, `${id}-pending-class-bearing-target`);
      const message = label === 'Copy HTML' ? 'HTML copied to clipboard'
        : label === 'Copy Styles' ? 'Styles copied to clipboard' : 'Copied to clipboard';
      await expect(toast(page)).toContainText(message);
      const pendingText = await copiedText(page, `${id}-pending-actual-clipboard`);
      if (label === 'Copy HTML') expect(pendingText).toBe(await markup(target));
      else if (label === 'Copy Styles') expect(pendingText).toBe(await styles(target));
      else await assertElement(page, target, pendingText);
      await expect(toolbarButton(page, 'selection')).not.toHaveClass(/point-grab-btn-active/);
      await expect(overlay(page)).not.toBeVisible();
      await checkpoint(page, `${id}-pending-completed`);

      // No second pick: all three actions use the established last target.
      await setClipboard(page, `${id}: replaced before selected action`);
      await action(page, label, `${id}-selected`, label === 'Copy Styles' ? target : undefined);
      await expect(toast(page)).toContainText(message);
      const selectedText = await copiedText(page, `${id}-selected-actual-clipboard`);
      expect(selectedText).toBe(label === 'Copy Styles' ? await styles(target) : pendingText);
      await expect(overlay(page)).not.toBeVisible();
      await checkpoint(page, `${id}-selected-completed-without-repick`);

      // Compare the entire Copy Element payload to the independent hold-to-grab UI
      // path; HTML/Styles are compared byte-for-byte to the live DOM above.
      if (label === 'Copy Element') expect(await referenceGrab(page, target, `${id}-hold-reference`, true)).toBe(pendingText);
      const second = secondTarget(page);
      const secondSnippet = await referenceGrab(page, second, `${id}-replacement-reference`);
      await setClipboard(page, `${id}: replaced before replacement action`);
      await action(page, label, `${id}-replacement`, label === 'Copy Styles' ? second : undefined);
      await expect(toast(page)).toContainText(message);
      const replacement = await copiedText(page, `${id}-replacement-actual-clipboard`);
      expect(replacement).toBe(label === 'Copy HTML' ? await markup(second)
        : label === 'Copy Styles' ? await styles(second) : secondSnippet);
      // Different real targets can legitimately share identical computed CSS.
      if (label !== 'Copy Styles') expect(replacement).not.toBe(pendingText);
      await checkpoint(page, `${id}-replacement-target-completed`);
      covered(id);
    });
  }

  test('comments: pending picker Escape, empty/whitespace rejection, draft edit, Cancel and focused Escape never copy', async ({ page }) => {
    const sentinel = `${framework}: cancellation must not copy`;
    await setClipboard(page, sentinel);
    await action(page, 'Add Comment', 'comments-cancel-pending');
    await profile.target(page).hover();
    await expect(overlay(page)).toBeVisible();
    await checkpoint(page, 'comments-cancel-pending-picker');
    await page.keyboard.press('Escape');
    await expect(overlay(page)).not.toBeVisible();
    await expect(confirm(page)).not.toBeVisible();
    expect(await clipboard(page)).toBe(sentinel);
    await checkpoint(page, 'comments-cancel-pending-picker-escaped');

    await action(page, 'Add Comment', 'comments-cancel-editor');
    await hoverThenPick(page, profile.target(page), 'comments-cancel-target');
    const dialog = commentDialog(page);
    const field = dialog.getByRole('textbox');
    for (const value of ['', '   ']) {
      await field.fill(value);
      await dialog.getByRole('button', { name: 'Add to Review' }).click();
      await expect(dialog).toBeVisible();
      await expect(field).toBeFocused();
      await expect(field).toHaveAttribute('placeholder', 'Please enter a comment...');
      await expect(confirm(page)).not.toBeVisible();
      expect(await clipboard(page)).toBe(sentinel);
      await checkpoint(page, `comments-cancel-${value ? 'whitespace' : 'empty'}-rejected`);
    }
    await field.fill('Draft before correction');
    await field.fill('Corrected draft that will be cancelled');
    await checkpoint(page, 'comments-cancel-draft-edited-before-submission');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(confirm(page)).not.toBeVisible();
    expect(await clipboard(page)).toBe(sentinel);
    await checkpoint(page, 'comments-cancel-button-left-no-review');

    // Already-selected path opens the editor immediately, with a fresh empty draft.
    await action(page, 'Add Comment', 'comments-cancel-selected');
    await expect(dialog).toBeVisible();
    await expect(field).toHaveValue('');
    await field.fill('Escape discards this draft');
    await checkpoint(page, 'comments-cancel-focused-draft-before-escape');
    await field.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(confirm(page)).not.toBeVisible();
    expect(await copiedText(page, 'comments-cancel-actual-unchanged-clipboard')).toBe(sentinel);
    await checkpoint(page, 'comments-cancel-escape-left-no-review');
    covered('comments-cancel');
  });

  test('comments: one selected element, editable draft and explicit Confirm & Copy', async ({ page }) => {
    const target = profile.target(page);
    const snippet = await referenceGrab(page, target, 'comments-single-reference', true);
    const sentinel = `${framework}: no copy before explicit confirmation`;
    await setClipboard(page, sentinel);
    await action(page, 'Add Comment', 'comments-single-selected');
    const field = commentDialog(page).getByRole('textbox');
    await expect(field).toHaveValue('');
    await field.fill('Superseded draft');
    await checkpoint(page, 'comments-single-initial-draft');
    const comment = `${framework}: make the authored classes easier to maintain`;
    await queueComment(page, `  ${comment}  `, 1, 'comments-single-revised-draft', 'Superseded draft');
    expect(await clipboard(page)).toBe(sentinel);
    await checkpoint(page, 'comments-single-awaiting-explicit-confirmation');
    await confirm(page).click();
    await expect(toast(page)).toContainText('Confirmed & copied 1 reviewed element');
    expect(await copiedText(page, 'comments-single-actual-confirmed-prompt')).toBe(`## Element 1\n${snippet}\n\nComment: ${comment}`);
    await expect(confirm(page)).not.toBeVisible();
    await expect(commentDialog(page)).not.toBeVisible();
    await expect(toolbarButton(page, 'selection')).not.toHaveClass(/point-grab-btn-active/);
    await expect(overlay(page)).not.toBeVisible();
    await checkpoint(page, 'comments-single-confirmed-and-review-cleared');
    covered('comments-single');
  });

  test('comments: two targets, cancelled additional draft, reselection appends rather than edits, then a fresh batch', async ({ page }) => {
    const first = profile.target(page), second = secondTarget(page);
    const firstSnippet = await referenceGrab(page, first, 'comments-multiple-first-reference', true);
    const secondSnippet = await referenceGrab(page, second, 'comments-multiple-second-reference');
    // Clear History resets the remembered target, exercising Add Comment's pending path.
    await chooseAction(page, 'Clear History');
    const sentinel = `${framework}: multi-review is not copied yet`;
    await setClipboard(page, sentinel);
    await action(page, 'Add Comment', 'comments-multiple-pending');
    await hoverThenPick(page, first, 'comments-multiple-first');
    const notes = [`${framework}: first note`, `${framework}: second note`, `${framework}: another note on the first target`];
    await queueComment(page, notes[0], 1, 'comments-multiple-first');
    expect(await clipboard(page)).toBe(sentinel);
    await hoverThenPick(page, second, 'comments-multiple-second');
    await queueComment(page, notes[1], 2, 'comments-multiple-second');
    expect(await clipboard(page)).toBe(sentinel);

    await hoverThenPick(page, first, 'comments-multiple-cancel-extra');
    await commentDialog(page).getByRole('textbox').fill('This discarded draft must never appear');
    await checkpoint(page, 'comments-multiple-extra-draft-before-cancel');
    await commentDialog(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(confirm(page)).toHaveAccessibleName('Confirm & Copy 2 reviewed elements');
    await checkpoint(page, 'comments-multiple-cancel-preserved-two-queued-items');
    await hoverThenPick(page, first, 'comments-multiple-reselect-first');
    await queueComment(page, notes[2], 3, 'comments-multiple-reselected-first-appended');
    expect(await clipboard(page)).toBe(sentinel);
    await confirm(page).click();
    await expect(toast(page)).toContainText('Confirmed & copied 3 reviewed elements');
    const expected = [firstSnippet, secondSnippet, firstSnippet]
      .map((snippet, i) => `## Element ${i + 1}\n${snippet}\n\nComment: ${notes[i]}`).join('\n\n---\n\n');
    expect(await copiedText(page, 'comments-multiple-actual-three-item-prompt')).toBe(expected);
    await expect(confirm(page)).not.toBeVisible();
    await expect(overlay(page)).not.toBeVisible();
    await checkpoint(page, 'comments-multiple-confirmed-queue-cleared');

    await action(page, 'Add Comment', 'comments-multiple-fresh-batch');
    const fresh = `${framework}: only this new review survives`;
    await queueComment(page, fresh, 1, 'comments-multiple-fresh-one-item-batch');
    await confirm(page).click();
    await expect(toast(page)).toContainText('Confirmed & copied 1 reviewed element');
    expect(await copiedText(page, 'comments-multiple-actual-fresh-batch-prompt')).toBe(`## Element 1\n${firstSnippet}\n\nComment: ${fresh}`);
    await expect(confirm(page)).not.toBeVisible();
    await checkpoint(page, 'comments-multiple-fresh-batch-has-no-old-comments');
    covered('comments-multiple');
  });
});
