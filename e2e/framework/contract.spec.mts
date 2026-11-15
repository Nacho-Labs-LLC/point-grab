/**
 * The Point Grab feature contract, run against every framework demo
 * (POINT_GRAB_FRAMEWORK selects which). Each test drives the real demo UI through a
 * user journey and asserts on what the user and their AI agent would actually get:
 * clipboard text, toasts, persisted MCP history and MCP tool results.
 */
import {
  test, expect, framework, profile, openApp, toolbar, toolbarButton, overlay, freezeLayer, toast,
  selectDialog, reviewDialog, preview, chooseAction, holdGrab, pick, clipboard, setClipboard,
  nextInspect, openScreenshot, regionOf, dragRegion, comparePreviewTo, transformOf, firstLine, settleScroll,
} from './fixtures.mts';

const FRAMEWORK_ATTRS = /data-v-[a-f0-9]|_ngcontent|_nghost|ng-reflect|data-point-grab-|class="[^"]*svelte-[a-z0-9]{4,}|data-reactroot/;

test.describe(`${framework} demo`, () => {
  test.beforeEach(async ({ page, errors }) => { void errors; await openApp(page); });

  test('arrival: toolbar, guide and MCP status are visible without any key press', async ({ page }) => {
    await expect(toolbar(page)).toBeVisible();
    await expect(toolbarButton(page, 'actions')).toBeVisible();
    await expect(page.getByTestId('playground-guide')).toBeVisible();
    await expect(page.getByTestId('mcp-status').first()).toHaveText('MCP server connected');
    await expect(page.getByTestId('mcp-status').first()).toHaveAttribute('data-state', 'online');
  });

  test('MCP status explains how to start the server when it is offline', async ({ page }) => {
    await page.context().unroute('http://localhost:3456/**');
    await page.context().route('http://localhost:3456/**', (route) => route.abort('connectionrefused'));
    await page.reload(); await profile.ready(page);
    const status = page.getByTestId('mcp-status').first();
    await expect(status).toContainText('MCP server offline');
    await expect(status).toContainText('npx @point-grab/mcp-server');
  });

  test('hold-to-grab copies HTML + adapter context, persists it to MCP, and history re-copies or clears it', async ({ page, mcp }) => {
    const target = await profile.interact(page);
    const text = (await target.innerText()).trim();
    const response = nextInspect(page, mcp);
    await holdGrab(page, target);
    const ack = await (await response).json();
    expect(ack.success).toBe(true);
    await expect(toast(page)).toContainText('Copied to clipboard');

    const snippet = await clipboard(page);
    expect(snippet).toContain(text);
    expect(snippet).toMatch(/<[a-z]/);
    expect(snippet).not.toMatch(FRAMEWORK_ATTRS);
    for (const pattern of profile.grab.snippet) expect(snippet).toMatch(pattern);

    const entry = (await mcp.history()).entries.find((e) => e.id === ack.id)!;
    expect(entry.context.html).toContain(text);
    if (profile.grab.component) expect(entry.context.componentName).toMatch(profile.grab.component);
    else expect(entry.context.componentName).toBeNull();
    const result = await mcp.client.callTool({ name: 'point_grab_get', arguments: { id: entry.id } });
    expect(JSON.stringify(result.content)).toContain(text.slice(0, 20));

    await toolbarButton(page, 'history').click();
    const history = page.getByRole('dialog', { name: 'Inspection history' });
    await expect(history).toBeVisible();
    const item = history.locator('.point-grab-history-item').first();
    await expect(item).toBeVisible();
    await setClipboard(page, 'replaced');
    await item.click();
    await expect(toast(page)).toContainText('Re-copied');
    expect(await clipboard(page)).toBe(snippet);

    await chooseAction(page, 'Clear History');
    await toolbarButton(page, 'history').click();
    await expect(history).toContainText('No elements inspected yet');
  });

  test('toolbar selection mode picks without the keyboard, stays on for more picks, and Escape leaves it', async ({ page }) => {
    const selection = toolbarButton(page, 'selection');
    await selection.click();
    await expect(selection).toHaveClass(/point-grab-btn-active/);
    await pick(page, profile.target(page));
    await expect(toast(page)).toContainText('Copied to clipboard');
    expect(await clipboard(page)).toContain(await firstLine(profile.target(page)));
    await pick(page, profile.second(page));
    expect(await clipboard(page)).toContain(await firstLine(profile.second(page)));
    await page.keyboard.press('Escape');
    await expect(selection).not.toHaveClass(/point-grab-btn-active/);
    await profile.target(page).hover();
    await expect(overlay(page)).not.toBeVisible();
  });

  test('Copy HTML / Copy Styles prompt a pick first, then act on the last selected element', async ({ page }) => {
    await chooseAction(page, 'Copy HTML');
    await pick(page, profile.target(page));
    await expect(toast(page)).toContainText('HTML copied');
    const html = await clipboard(page);
    expect(html.trimStart()).toMatch(/^<[a-z]/);
    expect(html).toContain(await firstLine(profile.target(page)));
    expect(html).not.toMatch(FRAMEWORK_ATTRS);

    // No re-pick: the action applies to the element just grabbed.
    await chooseAction(page, 'Copy Styles');
    await expect(overlay(page)).not.toBeVisible();
    await expect.poll(() => clipboard(page)).toMatch(/^\/\* Computed styles for <[a-z0-9-]+> \*\//);
    expect(await clipboard(page)).toMatch(/\n {2}[a-z-]+: .+;/);
  });

  test('comment batch: two elements with notes → Confirm & Copy produces one prompt', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: 'Add comment' });
    await chooseAction(page, 'Add Comment');
    await pick(page, profile.target(page));
    await dialog.getByRole('textbox').fill(`${framework}: make this bolder`);
    await dialog.getByRole('button', { name: 'Add to Review' }).click();
    await pick(page, profile.second(page));
    await dialog.getByRole('textbox').fill(`${framework}: align this left`);
    await dialog.getByRole('button', { name: 'Add to Review' }).click();
    await page.getByRole('button', { name: 'Confirm & Copy 2 reviewed elements' }).click();
    const prompt = await clipboard(page);
    expect(prompt).toContain('## Element 1');
    expect(prompt).toContain('## Element 2');
    expect(prompt).toContain(`Comment: ${framework}: make this bolder`);
    expect(prompt).toContain(`Comment: ${framework}: align this left`);
    if (profile.grab.component) expect(prompt).toMatch(new RegExp(`in ${profile.grab.component.source.replace(/^\^|\$$/g, '')}\\b`));
  });

  test('Freeze holds motion and a hover-only detail; Escape resumes; reduced motion stays still', async ({ page }) => {
    const motion = page.getByTestId('motion-sample').first();
    const trigger = page.getByTestId('freeze-trigger').first();
    const detail = page.getByTestId('freeze-popover').first();
    const moving = await transformOf(motion); await page.waitForTimeout(200);
    expect(await transformOf(motion)).not.toBe(moving);

    await trigger.hover(); await expect(detail).toBeVisible();
    await page.keyboard.down('Control'); await page.keyboard.down('b'); await page.keyboard.press('f');
    await page.keyboard.up('b'); await page.keyboard.up('Control');
    await expect(freezeLayer(page)).toBeVisible();
    await page.mouse.move(5, 5);
    await expect(detail).toBeVisible();
    const frozen = await transformOf(motion); await page.waitForTimeout(250);
    expect(await transformOf(motion)).toBe(frozen);

    await page.keyboard.press('Escape');
    await expect(freezeLayer(page)).not.toBeVisible();
    await expect(detail).not.toBeVisible();
    await page.waitForTimeout(200);
    expect(await transformOf(motion)).not.toBe(frozen);

    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.reload(); await profile.ready(page);
    const still = await transformOf(motion); await page.waitForTimeout(200);
    expect(await transformOf(motion)).toBe(still);
  });

  test('keyboard focus reveals a detail and F freezes it; screenshot selection holds motion until Cancel or Escape', async ({ page }) => {
    const motion = page.getByTestId('motion-sample').first();
    const trigger = page.getByTestId('freeze-trigger').first();
    const detail = page.getByTestId('freeze-popover').first();
    await trigger.focus(); await expect(detail).toBeVisible();
    await page.keyboard.press('f');
    await expect(freezeLayer(page)).toBeVisible();
    await page.mouse.move(5, 5);
    await expect(detail).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(freezeLayer(page)).not.toBeVisible();
    await trigger.blur(); await expect(detail).not.toBeVisible();

    for (const leave of ['Cancel', 'Escape'] as const) {
      await openScreenshot(page);
      await page.waitForTimeout(80);
      const held = await transformOf(motion); await page.waitForTimeout(220);
      expect(await transformOf(motion), `motion held during selection (${leave})`).toBe(held);
      if (leave === 'Cancel') await selectDialog(page).getByRole('button', { name: 'Cancel', exact: true }).click();
      else await page.keyboard.press('Escape');
      await expect(selectDialog(page)).not.toBeVisible();
      await page.waitForTimeout(200);
      expect(await transformOf(motion), `motion resumed after ${leave}`).not.toBe(held);
    }
  });

  test('a queued comment survives a cancelled screenshot and is still in Confirm & Copy', async ({ page, mcp }) => {
    await chooseAction(page, 'Add Comment');
    await pick(page, profile.target(page));
    const dialog = page.getByRole('dialog', { name: 'Add comment' });
    await dialog.getByRole('textbox').fill(`${framework}: queued before a screenshot`);
    await dialog.getByRole('button', { name: 'Add to Review' }).click();
    const before = (await mcp.history()).entries.length;
    await openScreenshot(page);
    await selectDialog(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    expect((await mcp.history()).entries).toHaveLength(before);
    await page.getByRole('button', { name: /^Confirm & Copy/ }).click();
    expect(await clipboard(page)).toContain(`Comment: ${framework}: queued before a screenshot`);
  });

  test('Freeze → Add screenshot keeps the frozen hover detail and captures it', async ({ page }) => {
    const trigger = page.getByTestId('freeze-trigger').first();
    const detail = page.getByTestId('freeze-popover').first();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.hover(); await expect(detail).toBeVisible();
    await page.keyboard.down('Control'); await page.keyboard.down('b'); await page.keyboard.press('f');
    await page.keyboard.up('b'); await page.keyboard.up('Control');
    await openScreenshot(page);
    await expect(detail).toBeVisible();
    const box = await regionOf(page, detail);
    await dragRegion(page, box);
    await expect(reviewDialog(page)).toBeVisible();
    await expect(preview(page)).toHaveJSProperty('naturalWidth', box.width);
    await reviewDialog(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(freezeLayer(page)).not.toBeVisible();
  });

  test('screenshot: drag → review → failed send keeps work → retry delivers a PNG through MCP', async ({ page, mcp }) => {
    await profile.interact(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const box = await regionOf(page, profile.shot(page));
    const reference = await page.screenshot(); // test-only compositor reference for the same region
    await setClipboard(page, 'clipboard untouched');
    const motion = page.getByTestId('motion-sample').first();

    await openScreenshot(page);
    const frozen = await transformOf(motion);
    await dragRegion(page, box, true);
    await expect(reviewDialog(page)).toBeVisible();
    await expect(preview(page)).toHaveJSProperty('naturalWidth', box.width);
    await expect(preview(page)).toHaveJSProperty('naturalHeight', box.height);
    const similarity = await comparePreviewTo(page, reference, box);
    expect(similarity.meanAbsoluteError, JSON.stringify(similarity)).toBeLessThan(25);
    expect(similarity.closePixelFraction, JSON.stringify(similarity)).toBeGreaterThan(0.7);
    await page.waitForTimeout(200);
    expect(await transformOf(motion)).toBe(frozen);

    await page.getByRole('button', { name: 'Retake', exact: true }).click();
    await expect(selectDialog(page)).toBeVisible();
    await dragRegion(page, box);
    await expect(reviewDialog(page)).toBeVisible();
    const src = await preview(page).getAttribute('src');

    const comment = `${framework}: tighten this spacing`;
    await page.getByRole('textbox', { name: 'Comment', exact: true }).fill(comment);
    const before = (await mcp.history()).entries.length;
    await page.route('http://localhost:3456/inspect', (route) => route.fulfill({ status: 503, headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' }));
    await page.getByRole('button', { name: 'Send image + comment' }).click();
    await expect(reviewDialog(page).getByRole('status')).toContainText('503');
    await expect(page.getByRole('textbox', { name: 'Comment', exact: true })).toHaveValue(comment);
    await expect(page.getByRole('button', { name: 'Send image + comment' })).toBeFocused();
    expect((await mcp.history()).entries).toHaveLength(before);

    await page.unroute('http://localhost:3456/inspect');
    const response = nextInspect(page, mcp);
    await page.getByRole('textbox', { name: 'Comment', exact: true }).press('Control+Enter');
    const ack = await (await response).json();
    expect(ack).toMatchObject({ success: true, imageAccepted: true });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(toast(page)).toContainText('Screen Grab sent');

    const entry = (await mcp.history()).entries.find((e) => e.id === ack.id)!;
    expect(entry.context.screenGrab).toMatchObject({ comment, width: box.width, height: box.height });
    expect(src).toBe(`data:image/png;base64,${entry.context.screenGrab.data}`);
    const result = await mcp.client.callTool({ name: 'point_grab_get', arguments: { id: entry.id } });
    expect(result.content).toContainEqual({ type: 'image', mimeType: 'image/png', data: entry.context.screenGrab.data });
    expect(JSON.stringify(result.content)).toContain(comment);
    expect(await clipboard(page)).toBe('clipboard untouched');

    await toolbarButton(page, 'history').click();
    await expect(page.getByRole('dialog', { name: 'Inspection history' })).toContainText(`Screenshot ${box.width} × ${box.height}`);
  });

  test('screenshots redact text fields without touching the live value', async ({ page }) => {
    const [secret] = profile.inputValues ?? ['SECRET-4242'];
    const input = await profile.input(page);
    await input.fill(secret);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    // Filling can scroll the field into view; measure only once the page is still.
    await input.scrollIntoViewIfNeeded();
    await settleScroll(page);
    const raw = (await input.boundingBox())!;
    const box = { x: Math.max(0, Math.round(raw.x) - 6), y: Math.max(0, Math.round(raw.y) - 6), width: Math.min(300, Math.round(raw.width) + 12), height: Math.round(raw.height) + 12 };
    const capture = async () => {
      await openScreenshot(page); await dragRegion(page, box);
      await expect(reviewDialog(page)).toContainText('Text fields are redacted');
      const data = await preview(page).getAttribute('src');
      await reviewDialog(page).getByRole('button', { name: 'Cancel', exact: true }).click();
      return data;
    };
    const withSecret = await capture();
    await expect(input).toHaveValue(secret);
    await input.fill('');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    // The field is hidden in the capture, so its content cannot change the pixels.
    expect(await capture()).toBe(withSecret);
  });

  test('native copy is untouched: selected text and text-field copy keep working', async ({ page }) => {
    const target = profile.copyText?.(page) ?? profile.target(page);
    const text = (await target.innerText()).trim();
    expect(text).not.toBe('');
    await target.evaluate((el) => {
      const range = document.createRange(); range.selectNodeContents(el);
      const selection = getSelection()!; selection.removeAllRanges(); selection.addRange(range);
    });
    await page.keyboard.press('Control+c');
    expect((await clipboard(page)).trim()).toBe(text);
    await expect(overlay(page)).not.toBeVisible();
    await page.evaluate(() => getSelection()?.removeAllRanges());

    const [, sample] = profile.inputValues ?? ['', 'copy me natively'];
    const input = await profile.input(page);
    await input.fill(sample);
    await input.press('Control+a'); await input.press('Control+c');
    expect(await clipboard(page)).toBe(sample);
    await expect(overlay(page)).not.toBeVisible();
  });

  test('toolbar controls: theme cycles, Enable/Disable gates the picker, Dismiss hides until next use', async ({ page }) => {
    const theme = toolbarButton(page, 'theme');
    const labels = [await theme.getAttribute('aria-label')];
    for (let i = 0; i < 3; i++) { await theme.click(); labels.push(await theme.getAttribute('aria-label')); }
    expect(new Set(labels.slice(0, 3)).size).toBe(3);
    expect(labels[3]).toBe(labels[0]);

    await toolbarButton(page, 'enable').click();
    await page.keyboard.down('Control'); await page.keyboard.down('b');
    await profile.target(page).hover(); await page.waitForTimeout(300);
    await expect(overlay(page)).not.toBeVisible();
    await page.keyboard.up('b'); await page.keyboard.up('Control');
    await toolbarButton(page, 'enable').click();

    await toolbarButton(page, 'dismiss').click();
    await expect(toolbar(page)).toHaveClass(/point-grab-toolbar-hidden/);
    await expect(toolbar(page)).toHaveCSS('pointer-events', 'none');
    await holdGrab(page, profile.target(page));
    await expect(toolbar(page)).not.toHaveClass(/point-grab-toolbar-hidden/);
  });

  test('phone width: no horizontal scroll and the toolbar stays reachable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload(); await profile.ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    const box = (await toolbar(page).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await expect(toolbarButton(page, 'actions')).toBeVisible();
  });
});
