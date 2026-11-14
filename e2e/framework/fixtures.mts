import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createPointGrabMcpServer, createFileHistoryStore } from '../../packages/mcp-server/dist/index.js';
import { profiles, type Framework, type Profile } from './profiles.mts';

export { expect };

export const framework = (process.env.POINT_GRAB_FRAMEWORK ?? 'vanilla') as Framework;
export const profile: Profile = profiles[framework];

/**
 * A real MCP server per worker: the demo's default `localhost:3456` transport is routed to
 * its ephemeral HTTP webhook (so a developer's own server is never touched), captures are
 * persisted to a disposable history file, and an SDK client reads them back over MCP.
 */
export interface Mcp {
  port: number;
  client: Client;
  history: () => Promise<{ entries: Array<{ id: string; snippet: string; context: Record<string, any> }> }>;
  inspectUrl: string;
}

export const test = base.extend<{ errors: string[] }, { mcp: Mcp }>({
  mcp: [async ({}, use) => {
    const directory = await mkdtemp(join(tmpdir(), `point-grab-${framework}-`));
    const historyPath = join(directory, 'history.json');
    const app = createPointGrabMcpServer({ historyPath });
    await app.historyStore.ensureHistoryFile();
    const client = new Client({ name: 'framework-contract', version: '1' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(a), app.server.connect(b)]);
    const webhook: Server = app.startWebhookServer(0);
    await once(webhook, 'listening');
    const port = (webhook.address() as { port: number }).port;
    await use({ port, client, history: () => createFileHistoryStore(historyPath).readHistory() as any, inspectUrl: `http://127.0.0.1:${port}/inspect` });
    await client.close();
    await new Promise<void>((resolve) => webhook.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }, { scope: 'worker' }],

  errors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await use(errors);
    expect(errors, 'uncaught page errors').toEqual([]);
  },

  page: async ({ page, mcp }, use) => {
    await page.context().route('http://localhost:3456/**', (route) =>
      route.continue({ url: route.request().url().replace('http://localhost:3456', `http://127.0.0.1:${mcp.port}`) }));
    await use(page);
  },
});

// --- Point Grab UI ---------------------------------------------------------------

export const toolbar = (page: Page) => page.locator('#__point-grab-toolbar__');
export const toolbarButton = (page: Page, name: string) => page.locator(`#__point-grab-toolbar__ [data-point-grab-btn="${name}"]`);
export const overlay = (page: Page) => page.locator('#__point-grab-overlay__');
export const freezeLayer = (page: Page) => page.locator('#__point-grab-freeze-overlay__');
export const toast = (page: Page) => page.locator('#__point-grab-toast__');
export const selectDialog = (page: Page) => page.getByRole('dialog', { name: 'Select current page region', exact: true });
export const reviewDialog = (page: Page) => page.getByRole('dialog', { name: 'Review screenshot', exact: true });
export const preview = (page: Page) => page.getByAltText('Selected screenshot region');

export async function openApp(page: Page) {
  await page.goto('/');
  await profile.ready(page);
}

export async function chooseAction(page: Page, label: string) {
  await toolbarButton(page, 'actions').click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
}

/** Hold Ctrl+C, hover, click: the primary grab gesture. */
export async function holdGrab(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  await page.keyboard.down('Control'); await page.keyboard.down('c');
  await target.hover();
  await expect(overlay(page)).toBeVisible();
  await target.click();
  await page.keyboard.up('c'); await page.keyboard.up('Control');
}

/** Hover + click while the picker is already active (toolbar selection mode or a pending action). */
export async function pick(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  await target.hover();
  await expect(overlay(page)).toBeVisible();
  await target.click();
}

export const clipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText());
export const setClipboard = (page: Page, text: string) => page.evaluate((t) => navigator.clipboard.writeText(t), text);

export function nextInspect(page: Page, mcp: Mcp) {
  return page.waitForResponse((r) => r.url() === mcp.inspectUrl && r.request().method() === 'POST');
}

export async function openScreenshot(page: Page) {
  await settleScroll(page);
  await chooseAction(page, 'Add screenshot');
  await expect(selectDialog(page)).toBeVisible();
}

export interface Box { x: number; y: number; width: number; height: number }

/** A region inside both the element and the viewport, capped so captures stay quick. */
/** Wait for (possibly smooth) scrolling to stop: selection treats any scroll as "page moved". */
export async function settleScroll(page: Page) {
  await expect.poll(async () => {
    const a = await page.evaluate(() => [scrollX, scrollY].join());
    await page.waitForTimeout(120);
    return a === await page.evaluate(() => [scrollX, scrollY].join());
  }).toBe(true);
}

export async function regionOf(page: Page, target: Locator, max = { width: 360, height: 240 }): Promise<Box> {
  await target.scrollIntoViewIfNeeded();
  await settleScroll(page);
  const box = (await target.boundingBox())!;
  const viewport = page.viewportSize()!;
  const x = Math.max(0, Math.round(box.x)), y = Math.max(0, Math.round(box.y));
  return {
    x, y,
    width: Math.min(max.width, Math.round(box.width), viewport.width - x - 1),
    height: Math.min(max.height, Math.round(box.height), viewport.height - y - 1),
  };
}

export async function dragRegion(page: Page, box: Box, reverse = false) {
  const [from, to] = reverse
    ? [{ x: box.x + box.width, y: box.y + box.height }, { x: box.x, y: box.y }]
    : [{ x: box.x, y: box.y }, { x: box.x + box.width, y: box.y + box.height }];
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 }); await page.mouse.up();
}

/** Compare the preview crop with a browser screenshot of the same CSS-pixel region. */
export async function comparePreviewTo(page: Page, png: Buffer, box: Box) {
  return preview(page).evaluate(async (img: HTMLImageElement, [bytes, b]) => {
    await img.decode();
    const source = new Image();
    source.src = URL.createObjectURL(new Blob([new Uint8Array(bytes as number[])], { type: 'image/png' }));
    await source.decode();
    const { x, y, width, height } = b as { x: number; y: number; width: number; height: number };
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(source, x, y, width, height, 0, 0, width, height);
    const expected = ctx.getImageData(0, 0, width, height).data;
    ctx.clearRect(0, 0, width, height); ctx.drawImage(img, 0, 0, width, height);
    const actual = ctx.getImageData(0, 0, width, height).data;
    URL.revokeObjectURL(source.src);
    let error = 0, close = 0;
    for (let i = 0; i < actual.length; i += 4) {
      const delta = Math.max(...[0, 1, 2].map((c) => Math.abs(actual[i + c] - expected[i + c])));
      if (delta <= 20) close++;
      for (const c of [0, 1, 2]) error += Math.abs(actual[i + c] - expected[i + c]);
    }
    return { meanAbsoluteError: error / (width * height * 3), closePixelFraction: close / (width * height) };
  }, [[...png], box] as const);
}

/** Sample a CSS transform so tests can tell whether motion is running or frozen. */
export const transformOf = (target: Locator) => target.evaluate((el) => getComputedStyle(el).transform);

/** The first non-empty line of an element's rendered text. */
export const firstLine = async (target: Locator) => (await target.innerText()).split('\n').map((l) => l.trim()).find(Boolean) ?? '';
