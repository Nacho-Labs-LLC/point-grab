/** Base/core controls, exercised on the real Vanilla player only.
 * Copy formats, comment review and freeze/capture lifecycles have separate suites.
 * No private API calls, storage seeding, or synthetic product DOM are used here.
 */
import type { Page } from '@playwright/test';
import {
  test, expect, openApp, profile, toolbar, toolbarButton, overlay, toast,
  holdGrab, pick, clipboard, setClipboard, chooseAction,
} from './fixtures.mts';
import { checkpoint } from '../checkpoint';

const history = (page: Page) => page.getByRole('dialog', { name: 'Inspection history', exact: true });
const actions = (page: Page) => page.getByRole('menu', { name: 'Actions', exact: true });
const covered = (description: string) => test.info().annotations.push({ type: 'coverage', description });

async function copied(page: Page, expected: string, attachment: string) {
  await expect.poll(() => clipboard(page)).toContain(expected);
  const output = await clipboard(page);
  expect(output).toMatch(/<[a-z]/);
  await test.info().attach(attachment, { body: output, contentType: 'text/plain' });
  return output;
}

// These are the actual rendered core palette values, not the theme button's labels.
async function palette(page: Page, mode: 'light' | 'dark') {
  const light = mode === 'light';
  await expect(toolbar(page)).toHaveCSS('background-color', light ? 'rgb(255, 255, 255)' : 'rgb(15, 23, 42)');
  await expect(toolbar(page)).toHaveCSS('border-top-color', light ? 'rgb(226, 232, 240)' : 'rgb(30, 41, 59)');
  // Dismiss is never the active or hovered control in these theme journeys.
  await expect(toolbarButton(page, 'dismiss')).toHaveCSS('color', light ? 'rgb(100, 116, 139)' : 'rgb(148, 163, 184)');
  await expect(history(page)).toHaveCSS('background-color', light ? 'rgb(255, 255, 255)' : 'rgb(15, 23, 42)');
  await expect(history(page).locator('.point-grab-history-empty')).toHaveCSS('color', light ? 'rgb(148, 163, 184)' : 'rgb(100, 116, 139)');
}

test.describe('Vanilla base toolbar states', () => {
  test.beforeEach(async ({ page, errors }) => { void errors; await openApp(page); });

  test('themes: actual dark/light/system colors, live OS changes and reload defaults', async ({ page }) => {
    test.setTimeout(60_000); // Named review checkpoints also run through the full media/reload cycle.
    const theme = toolbarButton(page, 'theme');
    await test.step('Default dark palette includes the toolbar and the empty history surface', async () => {
      await page.emulateMedia({ colorScheme: 'light' });
      await toolbarButton(page, 'history').click();
      await expect(history(page)).toBeVisible();
      await expect(theme).toHaveAccessibleName('Switch to light mode');
      await palette(page, 'dark');
      await checkpoint(page, 'themes-default-dark-toolbar-and-history');
    });
    await test.step('Explicit light mode ignores an OS switch to dark', async () => {
      await theme.click();
      await expect(theme).toHaveAccessibleName('Switch to system theme');
      await palette(page, 'light');
      await checkpoint(page, 'themes-explicit-light-toolbar-and-history');
      await page.emulateMedia({ colorScheme: 'dark' });
      await palette(page, 'light');
      await checkpoint(page, 'themes-explicit-light-survives-os-dark');
    });
    await test.step('System mode follows both directions of live prefers-color-scheme changes', async () => {
      await theme.click();
      await expect(theme).toHaveAccessibleName('Switch to dark mode');
      await palette(page, 'dark');
      await checkpoint(page, 'themes-system-dark');
      await page.emulateMedia({ colorScheme: 'light' });
      await palette(page, 'light');
      await checkpoint(page, 'themes-system-live-light');
      await page.emulateMedia({ colorScheme: 'dark' });
      await palette(page, 'dark');
      await checkpoint(page, 'themes-system-live-dark-again');
    });
    await test.step('Cycling to explicit dark detaches system tracking', async () => {
      await theme.click();
      await expect(theme).toHaveAccessibleName('Switch to light mode');
      await page.emulateMedia({ colorScheme: 'light' });
      await palette(page, 'dark');
      await checkpoint(page, 'themes-explicit-dark-ignores-os-light');
    });
    await test.step('Theme is instance-local, not a promised persistent preference', async () => {
      await theme.click();
      await palette(page, 'light');
      await page.reload();
      await profile.ready(page);
      await expect(theme).toHaveAccessibleName('Switch to light mode');
      await toolbarButton(page, 'history').click();
      await palette(page, 'dark');
      await checkpoint(page, 'themes-reload-restores-default-dark');
    });
    covered('base-themes');
  });

  test('history: empty, two real grabs, newest-first re-copy, close/reopen and clear', async ({ page }) => {
    test.setTimeout(60_000);
    const items = history(page).locator('.point-grab-history-item');
    let first = '', second = '';
    await test.step('Empty history closes and reopens using its toolbar toggle', async () => {
      await toolbarButton(page, 'history').click();
      await expect(history(page)).toBeVisible();
      await expect(history(page)).toContainText('No elements inspected yet');
      await expect(items).toHaveCount(0);
      await checkpoint(page, 'history-empty-open');
      await toolbarButton(page, 'history').click();
      await expect(history(page)).not.toBeVisible();
      await checkpoint(page, 'history-empty-closed');
      await toolbarButton(page, 'history').click();
      await expect(history(page)).toBeVisible();
      await checkpoint(page, 'history-empty-reopened');
      await toolbarButton(page, 'history').click();
    });
    await test.step('Two different live elements produce two history entries', async () => {
      await holdGrab(page, profile.target(page));
      first = await copied(page, 'Neon Dreams', 'history-original-title-clipboard');
      await holdGrab(page, profile.second(page));
      second = await copied(page, (await profile.second(page).innerText()).trim(), 'history-original-queue-clipboard');
      expect(second).not.toBe(first);
      await toolbarButton(page, 'history').click();
      await expect(items).toHaveCount(2);
      await expect(items.nth(0)).toContainText('.queue-title');
      await expect(items.nth(1)).toContainText('#track-title');
      // A recent-copy toast may still be visible; it must not mask history labels.
      expect(Number(await history(page).evaluate(el => getComputedStyle(el).zIndex)))
        .toBeGreaterThan(Number(await toast(page).evaluate(el => getComputedStyle(el).zIndex)));
      await checkpoint(page, 'history-populated-newest-first');
      await toolbarButton(page, 'history').click();
      await expect(history(page)).not.toBeVisible();
      await checkpoint(page, 'history-populated-closed');
      await toolbarButton(page, 'history').click();
      await expect(items).toHaveCount(2);
      await checkpoint(page, 'history-populated-reopened');
    });
    await test.step('Both rows restore their exact original clipboard output and close history', async () => {
      for (const [index, original] of [second, first].entries()) {
        await setClipboard(page, `history recopy sentinel ${index}`);
        await items.nth(index).click();
        await expect(history(page)).not.toBeVisible();
        await expect(toast(page)).toContainText('Re-copied to clipboard');
        await expect.poll(() => clipboard(page)).toBe(original);
        await test.info().attach(`history-recopied-row-${index + 1}`, { body: await clipboard(page), contentType: 'text/plain' });
        await checkpoint(page, `history-row-${index + 1}-recopied-panel-closed`);
        await toolbarButton(page, 'history').click();
        await expect(items).toHaveCount(2);
      }
    });
    await test.step('Clear History closes the menu and leaves empty history after reopen', async () => {
      await chooseAction(page, 'Clear History');
      await expect(actions(page)).not.toBeVisible();
      await expect(history(page)).not.toBeVisible();
      await toolbarButton(page, 'history').click();
      await expect(items).toHaveCount(0);
      await expect(history(page)).toContainText('No elements inspected yet');
      await checkpoint(page, 'history-cleared-empty');
      await toolbarButton(page, 'history').click();
      await toolbarButton(page, 'history').click();
      await expect(items).toHaveCount(0);
      await checkpoint(page, 'history-cleared-stays-empty-on-reopen');
    });
    covered('base-history');
  });

  test('selection: toolbar on picks repeatedly; toolbar off restores native application clicks', async ({ page }) => {
    const selection = toolbarButton(page, 'selection');
    await test.step('Toolbar activation selects and copies without a held keyboard shortcut', async () => {
      await selection.click();
      await expect(selection).toHaveClass(/point-grab-btn-active/);
      await profile.target(page).hover();
      await expect(overlay(page)).toBeVisible();
      await checkpoint(page, 'selection-toolbar-on-hover');
      await pick(page, profile.target(page));
      await copied(page, 'Neon Dreams', 'selection-first-pick-clipboard');
      await expect(selection).toHaveClass(/point-grab-btn-active/);
      await pick(page, profile.second(page));
      await copied(page, (await profile.second(page).innerText()).trim(), 'selection-second-pick-clipboard');
      await expect(selection).toHaveClass(/point-grab-btn-active/);
      await checkpoint(page, 'selection-stays-active-after-second-pick');
    });
    await test.step('Clicking the selection button again, not Escape, turns selection off', async () => {
      const before = await clipboard(page);
      await selection.click();
      await expect(selection).not.toHaveClass(/point-grab-btn-active/);
      await profile.target(page).hover();
      await expect(overlay(page)).not.toBeVisible();
      await page.locator('#btn-next').click();
      await expect(page.locator('#track-title')).toHaveText('Midnight Circuit');
      expect(await clipboard(page)).toBe(before);
      await checkpoint(page, 'selection-toolbar-off-native-next-track-works');
    });
    covered('base-selection-toggle');
  });

  test('power: disable cancels active picking, blocks real grabs, and re-enable restores them', async ({ page }) => {
    const power = toolbarButton(page, 'enable');
    const left = toolbar(page).locator('.point-grab-toolbar-left');
    await test.step('Start with an active picker and a real successful grab', async () => {
      await toolbarButton(page, 'selection').click();
      await pick(page, profile.target(page));
      await copied(page, 'Neon Dreams', 'power-before-disable-clipboard');
      await checkpoint(page, 'power-enabled-active-picker');
    });
    await test.step('Power off collapses controls and prevents shortcut interception', async () => {
      await power.click();
      await expect(power).not.toHaveClass(/point-grab-btn-active/);
      await expect(left).toHaveCSS('max-width', '0px');
      await expect(left).toHaveCSS('opacity', '0');
      await expect(left).toHaveCSS('pointer-events', 'none');
      await expect(toolbarButton(page, 'selection')).not.toHaveClass(/point-grab-btn-active/);
      await expect(toolbarButton(page, 'theme')).toBeVisible();
      await expect(toolbarButton(page, 'dismiss')).toBeVisible();
      const before = await clipboard(page);
      await page.keyboard.down('Control'); await page.keyboard.down('b');
      try {
        await profile.target(page).hover();
        await expect(overlay(page)).not.toBeVisible();
        await page.locator('#btn-next').click();
        await expect(page.locator('#track-title')).toHaveText('Midnight Circuit');
        expect(await clipboard(page)).toBe(before);
        await checkpoint(page, 'power-disabled-shortcut-does-not-grab-native-click-works');
      } finally { await page.keyboard.up('b'); await page.keyboard.up('Control'); }
    });
    await test.step('Power on restores toolbar controls and an actual shortcut grab', async () => {
      await power.click();
      await expect(power).toHaveClass(/point-grab-btn-active/);
      await expect(left).toHaveCSS('opacity', '1');
      await expect(left).toHaveCSS('pointer-events', 'auto');
      await expect(toolbarButton(page, 'selection')).toBeVisible();
      await expect(toolbarButton(page, 'actions')).toBeVisible();
      await expect(toolbarButton(page, 'history')).toBeVisible();
      await expect(toolbarButton(page, 'freeze')).toBeVisible();
      await holdGrab(page, profile.target(page));
      await copied(page, 'Midnight Circuit', 'power-reenabled-real-grab-clipboard');
      await expect(toast(page)).toContainText('Copied to clipboard');
      await checkpoint(page, 'power-reenabled-real-grab-succeeded');
    });
    covered('base-enable-disable');
  });

  test('dismiss: hides toolbar, closes popovers and picker; a real activation reopens it', async ({ page }) => {
    await test.step('Dismiss an active picker with an open actions menu', async () => {
      await toolbarButton(page, 'selection').click();
      await profile.target(page).hover();
      await expect(overlay(page)).toBeVisible();
      await toolbarButton(page, 'actions').click();
      await expect(actions(page)).toBeVisible();
      await checkpoint(page, 'dismiss-before-active-toolbar-and-actions');
      await toolbarButton(page, 'dismiss').click();
      // hide() keeps the DOM node mounted: opacity/pointer-events, not display:none.
      await expect(toolbar(page)).toHaveCSS('opacity', '0');
      await expect(toolbar(page)).toHaveCSS('pointer-events', 'none');
      await expect(actions(page)).not.toBeVisible();
      await profile.target(page).hover();
      await expect(overlay(page)).not.toBeVisible();
      await page.locator('#btn-next').click();
      await expect(page.locator('#track-title')).toHaveText('Midnight Circuit');
      await checkpoint(page, 'dismiss-hidden-native-page-usable');
    });
    await test.step('Keyboard activation reveals toolbar again and still copies live content', async () => {
      await page.keyboard.down('Control'); await page.keyboard.down('b');
      try {
        await expect(toolbar(page)).toHaveCSS('opacity', '1');
        await expect(toolbar(page)).toHaveCSS('pointer-events', 'auto');
        await expect(toolbarButton(page, 'selection')).toHaveClass(/point-grab-btn-active/);
        await profile.target(page).hover();
        await expect(overlay(page)).toBeVisible();
        await checkpoint(page, 'dismiss-reopened-by-real-shortcut');
        await profile.target(page).click();
        await copied(page, 'Midnight Circuit', 'dismiss-reopened-real-grab-clipboard');
      } finally { await page.keyboard.up('b'); await page.keyboard.up('Control'); }
      await expect(toolbarButton(page, 'selection')).not.toHaveClass(/point-grab-btn-active/);
      await expect(toolbar(page)).toHaveCSS('opacity', '1');
      await checkpoint(page, 'dismiss-reopened-toolbar-remains-after-key-release');
    });
    covered('base-dismiss');
  });

  test('actions menu: real inventory, toggle, Escape, outside click and panel exclusion', async ({ page }) => {
    await test.step('Open menu exposes every implemented action, then toggle closes it', async () => {
      await toolbarButton(page, 'actions').click();
      await expect(actions(page)).toBeVisible();
      await expect(actions(page).getByRole('menuitem')).toHaveText([
        'Copy Element', 'Copy Styles', 'Copy HTML', 'Add Comment', 'Add screenshot', 'Clear History',
      ]);
      await expect(toolbarButton(page, 'copyPrompt')).not.toBeVisible();
      await checkpoint(page, 'actions-open-complete-real-inventory');
      await toolbarButton(page, 'actions').click();
      await expect(actions(page)).not.toBeVisible();
      await checkpoint(page, 'actions-toolbar-toggle-closed');
    });
    await test.step('Escape dismisses an inactive menu and restores trigger focus; outside click also dismisses', async () => {
      await toolbarButton(page, 'actions').click();
      await expect(actions(page)).toBeVisible();
      await checkpoint(page, 'actions-visible-before-escape');
      await page.keyboard.press('Escape');
      await expect(actions(page)).not.toBeVisible();
      await expect(toolbarButton(page, 'actions')).toBeFocused();
      await expect(toolbarButton(page, 'selection')).not.toHaveClass(/point-grab-btn-active/);
      await checkpoint(page, 'actions-escape-closed-trigger-focused');
      await toolbarButton(page, 'actions').click();
      await profile.target(page).click();
      await expect(actions(page)).not.toBeVisible();
      await checkpoint(page, 'actions-outside-click-closed');
    });
    await test.step('History and actions replace one another without overlapping panels', async () => {
      await toolbarButton(page, 'history').click();
      await expect(history(page)).toBeVisible();
      await toolbarButton(page, 'actions').click();
      await expect(history(page)).not.toBeVisible();
      await expect(actions(page)).toBeVisible();
      await checkpoint(page, 'actions-replaces-history');
      await toolbarButton(page, 'history').click();
      await expect(actions(page)).not.toBeVisible();
      await expect(history(page)).toBeVisible();
      await checkpoint(page, 'history-replaces-actions');
      await profile.target(page).click();
      await expect(history(page)).not.toBeVisible();
      await checkpoint(page, 'history-outside-click-closed');
    });
    covered('base-actions-menu');
  });
});
