import { test, expect, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createPointGrabMcpServer, createFileHistoryStore } from '../packages/mcp-server/dist/index.js';

const framework = process.env.POINT_GRAB_FRAMEWORK ?? 'vanilla';
let directory: string, historyPath: string, webhook: Server, client: Client;
test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), `point-grab-${framework}-`));
  historyPath = join(directory, 'history.json');
  const app = createPointGrabMcpServer({ historyPath });
  await app.historyStore.ensureHistoryFile();
  client = new Client({ name: 'framework-browser-regression', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(a), app.server.connect(b)]);
  webhook = app.startWebhookServer(0);
  await once(webhook, 'listening');
});
test.afterAll(async () => {
  await client?.close();
  if (webhook) await new Promise<void>(resolve => webhook.close(() => resolve()));
  if (directory) await rm(directory, { recursive: true, force: true });
});
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  (page as any).__errors = errors;
  // Route the demo's default transport to our real ephemeral HTTP listener, avoiding
  // collisions with a developer's MCP server or another independent browser suite.
  await page.context().route('http://localhost:3456/inspect', route => route.continue({
    url: `http://127.0.0.1:${(webhook.address() as { port: number }).port}/inspect`,
  }));
  await page.goto('/');
});
test.afterEach(async ({ page }) => expect((page as any).__errors).toEqual([]));
const history = () => createFileHistoryStore(historyPath).readHistory();

// Exercise each demo's actual rendered state, not a test-injected replacement component.
async function interact(page: Page) {
  if (framework === 'vanilla') {
    await page.locator('#btn-next').click();
    await expect(page.locator('#track-title')).toHaveText('Midnight Circuit');
    return page.locator('#track-title');
  }
  if (framework === 'react') {
    await page.locator('.like-btn').first().click();
    await expect(page.locator('.like-btn').first()).toContainText('49');
    return page.locator('.post-text').first();
  }
  if (framework === 'vue') {
    await page.getByRole('button', { name: 'Forest', exact: true }).click();
    await page.getByRole('button', { name: 'M', exact: true }).click();
    await page.getByRole('button', { name: 'Add to Cart', exact: true }).click();
    await expect(page.locator('.cart-item-meta')).toHaveText('Forest · M');
    await page.getByRole('button', { name: 'Close cart' }).click();
    return page.locator('.product-name');
  }
  if (framework === 'angular') {
    await page.getByRole('button', { name: 'Inspectable detail', exact: true }).first().click();
    await expect(page.locator('.detail-panel').first()).toContainText('PostCardComponent');
    return page.locator('.post-copy').first();
  }
  if (framework === 'svelte') {
    await page.getByRole('button', { name: '+ New Note', exact: true }).click();
    await page.getByPlaceholder('Note title').fill('Framework matrix note');
    await expect(page.locator('.note-title-preview').first()).toHaveText('Framework matrix note');
    await page.getByPlaceholder('Note title').blur();
    return page.locator('.note-title-preview').first();
  }
  if (framework === 'web-components') {
    const tooltip = page.locator('forge-tooltip').first();
    await tooltip.hover();
    await expect(tooltip.locator('.tooltip-bubble')).toBeVisible();
    await expect(tooltip.locator('.tooltip-bubble')).toHaveText('Send a message');
    return page.locator('forge-card .card-heading').first();
  }
  await page.getByRole('button', { name: 'Add Arc lamp to bag', exact: true }).click();
  await expect(page.getByTestId('bag-count')).toHaveText('1');
  return page.locator('.product-card h3').first();
}
async function actions(page: Page) {
  await page.getByRole('button', { name: 'Actions', exact: true }).click();
}
async function openScreenshot(page: Page) {
  await actions(page);
  await page.getByText('Add screenshot', { exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Select current page region', exact: true })).toBeVisible();
}
async function captureCurrentPage(page: Page) {
  await page.mouse.move(150, 150); await page.mouse.down();
  await page.mouse.move(350, 290, { steps: 5 }); await page.mouse.up();
  await expect(page.getByRole('dialog', { name: 'Review screenshot' })).toBeVisible();
  await expect(page.getByAltText('Selected screenshot region')).toHaveJSProperty('naturalWidth', 200);
  await expect(page.getByAltText('Selected screenshot region')).toHaveJSProperty('naturalHeight', 140);
}

test(`${framework}: live motion → explicit Freeze preserves transient detail → Escape resumes; screenshot Cancel restores motion`, async ({ page }) => {
  const motion = page.getByTestId(framework === 'solid' ? 'demo-motion' : 'motion-sample').first();
  const trigger = page.getByTestId(framework === 'solid' ? 'demo-detail-trigger' : 'freeze-trigger').first();
  const detail = page.getByTestId(framework === 'solid' ? 'demo-detail' : 'freeze-popover').first();
  const sample = () => motion.evaluate(el => getComputedStyle(el).transform);
  await expect(motion).toBeVisible();
  const moving = await sample(); await page.waitForTimeout(180); expect(await sample()).not.toBe(moving);
  await trigger.hover(); await expect(detail).toBeVisible();
  await page.keyboard.down('Control'); await page.keyboard.down('c'); await page.keyboard.press('f');
  await page.keyboard.up('c'); await page.keyboard.up('Control');
  await expect(page.locator('#__point-grab-freeze-overlay__')).toBeVisible();
  await page.mouse.move(10, 10); await expect(detail).toBeVisible();
  await page.waitForTimeout(80); const frozen = await sample(); await page.waitForTimeout(220); expect(await sample()).toBe(frozen);
  await page.keyboard.press('Escape'); await expect(page.locator('#__point-grab-freeze-overlay__')).not.toBeVisible();
  await expect(detail).not.toBeVisible(); await page.waitForTimeout(180); expect(await sample()).not.toBe(frozen);
  await trigger.focus(); await expect(detail).toBeVisible();
  await page.keyboard.press('f'); await expect(page.locator('#__point-grab-freeze-overlay__')).toBeVisible();
  await page.mouse.move(10, 10); await expect(detail).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.locator('#__point-grab-freeze-overlay__')).not.toBeVisible();
  await trigger.blur(); await expect(detail).not.toBeVisible();
  await openScreenshot(page); await page.waitForTimeout(80); const selection = await sample();
  await page.waitForTimeout(220); expect(await sample()).toBe(selection);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await page.waitForTimeout(180); expect(await sample()).not.toBe(selection);
  await openScreenshot(page); await page.waitForTimeout(80); const escapeSelection = await sample();
  await page.waitForTimeout(220); expect(await sample()).toBe(escapeSelection);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Select current page region', exact: true })).not.toBeVisible();
  await page.waitForTimeout(180); expect(await sample()).not.toBe(escapeSelection);
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.reload();
  await expect(motion).toBeVisible(); const reduced = await sample(); await page.waitForTimeout(180); expect(await sample()).toBe(reduced);
});

test(`${framework}: real interactive component → native copy → adapter context → queued comment survives screenshot Cancel`, async ({ page }) => {
  const target = await interact(page);
  const text = (await target.innerText()).trim();
  await target.evaluate(el => {
    const range = document.createRange(); range.selectNodeContents(el);
    const selection = el.ownerDocument.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
  });
  await page.keyboard.press('Control+c');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text);
  await expect(page.locator('#__point-grab-overlay__')).not.toBeVisible();
  await page.evaluate(() => getSelection()?.removeAllRanges());
  await page.keyboard.down('Control'); await page.keyboard.down('c');
  await target.hover();
  await expect(page.locator('#__point-grab-overlay__')).toBeVisible();
  const persisted = page.waitForResponse(r => r.url() === `http://127.0.0.1:${(webhook.address() as { port: number }).port}/inspect` && r.request().method() === 'POST');
  await target.click();
  const copiedResponse = await persisted;
  expect(copiedResponse.ok()).toBe(true);
  const copiedAck = await copiedResponse.json();
  await page.keyboard.up('c'); await page.keyboard.up('Control');
  await expect(page.locator('#__point-grab-toast__')).toContainText('Copied to clipboard');
  const snippet = await page.evaluate(() => navigator.clipboard.readText());
  expect(snippet).toContain(text);
  expect(snippet).toMatch(/<[a-z]/);
  const entry = (await history()).entries.find(entry => entry.id === copiedAck.id)!;
  expect(entry).toBeDefined();
  expect(entry.context.html).toContain(text);
  const names: Record<string, RegExp> = { react: /^Post$/, vue: /^App$/, angular: /^PostCardComponent$/, svelte: /^NoteCard$/, 'web-components': /^ForgeCard$/, solid: /^ProductCard$/ };
  if (names[framework]) expect(entry.context.componentName).toMatch(names[framework]);
  if (framework === 'solid') expect(entry.context.filePath).toContain('App.tsx');
  await actions(page);
  await page.getByText('Add Comment', { exact: true }).click();
  await page.getByRole('dialog', { name: 'Add comment' }).getByRole('textbox').fill(`${framework} queued comment`);
  await page.getByRole('button', { name: 'Add to Review', exact: true }).click();
  const before = (await history()).entries.length;
  await openScreenshot(page);
  await page.getByRole('dialog', { name: 'Select current page region', exact: true }).getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await history()).entries).toHaveLength(before);
  await page.getByRole('button', { name: /Confirm & Copy/ }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(`${framework} queued comment`);
});

test(`${framework}: ${['angular', 'web-components'].includes(framework) ? 'unsupported live-page content → visible rejection, no fabricated image' : 'live page drag → DOM preview/comment → failed send retry → persisted MCP image'}`, async ({ page }) => {
  await interact(page);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  // Browser screenshot is a TEST-ONLY compositor reference; product captures the live DOM.
  await page.evaluate(() => Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true }));
  const png = await page.screenshot();
  await page.evaluate(() => navigator.clipboard.writeText('native clipboard unchanged'));
  await page.keyboard.press('Control+c');
  await openScreenshot(page);
  if (framework === 'angular' || framework === 'web-components') {
    const before = (await history()).entries.length;
    await page.mouse.move(150, 150); await page.mouse.down();
    await page.mouse.move(350, 290, { steps: 5 }); await page.mouse.up();
    await expect(page.getByRole('alert')).toContainText(framework === 'angular' ? 'filters' : 'shadow DOM');
    await expect(page.getByAltText('Selected screenshot region')).toHaveCount(0);
    await page.getByRole('dialog', { name: 'Select current page region', exact: true }).getByRole('button', { name: 'Cancel', exact: true }).click();
    expect((await history()).entries).toHaveLength(before);
    return; // Honest renderer boundary, not an image-success certification for these regions.
  }
  const motion = page.getByTestId(framework === 'solid' ? 'demo-motion' : 'motion-sample').first();
  const sample = () => motion.evaluate(el => getComputedStyle(el).transform);
  await page.waitForTimeout(80); const frozen = await sample();
  const assertFrozen = async () => { await page.waitForTimeout(180); expect(await sample()).toBe(frozen); };
  await captureCurrentPage(page); await assertFrozen();
  await page.getByRole('button', { name: 'Retake', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Select current page region', exact: true })).toBeVisible();
  await assertFrozen();
  await captureCurrentPage(page); await assertFrozen();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Review screenshot' })).not.toBeVisible();
  await page.waitForTimeout(180); expect(await sample()).not.toBe(frozen);
  await openScreenshot(page); await captureCurrentPage(page);
  const finalFrozen = await sample();
  const preview = await page.getByAltText('Selected screenshot region').getAttribute('src');
  const pixelsMatchSource = await page.getByAltText('Selected screenshot region').evaluate(async (preview: HTMLImageElement, bytes) => {
    const source = new Image();
    source.src = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
    await source.decode();
    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 140;
    const context = canvas.getContext('2d')!;
    context.drawImage(source, 150, 150, 200, 140, 0, 0, 200, 140);
    const expected = context.getImageData(0, 0, 200, 140).data;
    context.clearRect(0, 0, 200, 140); context.drawImage(preview, 0, 0);
    const actual = context.getImageData(0, 0, 200, 140).data;
    URL.revokeObjectURL(source.src);
    let error = 0, close = 0;
    for (let i = 0; i < actual.length; i += 4) {
      const delta = Math.max(...[0, 1, 2].map(c => Math.abs(actual[i+c] - expected[i+c])));
      if (delta <= 20) close++;
      for (const c of [0, 1, 2]) error += Math.abs(actual[i+c] - expected[i+c]);
    }
    return { meanAbsoluteError: error / (200 * 140 * 3), closePixelFraction: close / (200 * 140) };
  }, [...png]);
  console.log(framework, 'DOM-vs-browser pixels', pixelsMatchSource);
  // DOM reconstruction is not a compositor screenshot: tolerate text antialiasing/CSS differences,
  // but reject blank/wrong-area captures. Exact color/DPR checks live in page-capture.spec.mts.
  expect(pixelsMatchSource.meanAbsoluteError).toBeLessThan(25);
  expect(pixelsMatchSource.closePixelFraction).toBeGreaterThan(.70);
  await page.screenshot({ path: `test-results/framework-matrix/${framework}-page-preview.png` });
  const comment = `${framework}: change this current page region`;
  await page.getByRole('textbox', { name: 'Comment', exact: true }).fill(comment);
  const before = (await history()).entries.length;
  await page.route('http://localhost:3456/inspect', route => route.fulfill({ status: 503, headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' }));
  await page.getByRole('button', { name: 'Send image + comment' }).click();
  await expect(page.getByRole('dialog', { name: 'Review screenshot' }).getByRole('status')).toContainText('503');
  await expect(page.getByRole('textbox', { name: 'Comment', exact: true })).toHaveValue(comment);
  await page.waitForTimeout(180); expect(await sample()).toBe(finalFrozen);
  expect((await history()).entries).toHaveLength(before);
  await page.unroute('http://localhost:3456/inspect');
  const responsePromise = page.waitForResponse(r => r.url() === `http://127.0.0.1:${(webhook.address() as { port: number }).port}/inspect` && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Send image + comment' }).click();
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  const ack = await response.json();
  expect(ack.success).toBe(true);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const entries = (await history()).entries;
  expect(entries).toHaveLength(before + 1);
  const entry = entries[0];
  expect(entry.id).toBe(ack.id);
  expect(entry.context.screenGrab.comment).toBe(comment);
  expect(entry.context.screenGrab.region.width).toBe(200);
  expect(entry.context.screenGrab.region.height).toBe(140);
  expect(preview).toBe(`data:image/png;base64,${entry.context.screenGrab.data}`);
  const result = await client.callTool({ name: 'point_grab_get', arguments: { id: entry.id } });
  expect(result.content).toContainEqual({ type: 'image', mimeType: 'image/png', data: entry.context.screenGrab.data });
  expect(JSON.stringify(result.content)).toContain(comment);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('native clipboard unchanged');
  await page.waitForTimeout(180); expect(await sample()).not.toBe(finalFrozen);
});
