import { test, expect, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createPointGrabMcpServer, createFileHistoryStore } from '../packages/mcp-server/dist/index.js';

let web: Server, webhook: Server, url: string, directory: string, historyPath: string, client: Client;
const errors: string[] = [];
test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'point-grab-browser-'));
  historyPath = join(directory, 'history.json');
  const app = createPointGrabMcpServer({ historyPath });
  await app.historyStore.ensureHistoryFile();
  client = new Client({ name: 'screen-grab-browser-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(a), app.server.connect(b)]);
  webhook = app.startWebhookServer(3456);
  await once(webhook, 'listening');
  const bundle = await readFile(join(process.cwd(), 'packages/core/dist/index.global.js'));
  const demo = await readFile(join(process.cwd(), 'packages/core/demo.html'), 'utf8');
  web = createServer((req, res) => {
    if (req.url === '/dist/index.global.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle); return; }
    if (req.url === '/demo') { res.setHeader('Content-Type', 'text/html'); res.end(demo); return; }
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><html><head><title>Point Grab Screen Test</title></head><body style="margin:0;background:#fff;font:18px system-ui"><div id="target" style="position:absolute;left:100px;top:100px;width:300px;height:200px;background:rgb(255,0,0)">Real screenshot target</div><p id="copy" style="position:absolute;top:400px">Normal copy still works</p><textarea aria-label="Normal input" style="position:absolute;top:480px"></textarea><script src="/dist/index.global.js"></script><script>window.pg=PointGrab.init({devOnly:false,mcpWebhook:true});</script></body></html>`);
  });
  web.listen(0, '127.0.0.1'); await once(web, 'listening');
  url = `http://127.0.0.1:${(web.address() as {port:number}).port}`;
});
test.afterAll(async () => {
  await client?.close();
  for (const server of [web, webhook]) if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (directory) await rm(directory, { recursive: true, force: true });
});
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  // Portable intake must work with no capture API, even on an insecure/unsupported browser.
  await page.evaluate(() => Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true }));
});
test.afterEach(() => { expect(errors).toEqual([]); });

async function open(page: Page) {
  await page.keyboard.press('Control+c');
  await page.getByRole('button', { name: 'Actions', exact: true }).click();
  await page.getByText('Add screenshot', { exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Add or paste a screenshot', exact: true })).toBeVisible();
}
async function upload(page: Page) {
  // An actual PNG screenshot from Chromium, supplied as a user file. Product code never captures the DOM.
  const png = await page.screenshot();
  await open(page);
  await page.getByLabel('Screenshot file').setInputFiles({ name: 'screen.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByRole('dialog', { name: 'Drag a screenshot region' })).toBeVisible();
}
async function drag(page: Page, reverse = false) {
  const rect = (await page.getByLabel('Screenshot to crop').boundingBox())!;
  const x = (v: number) => rect.x + rect.width * v / 1000;
  const y = (v: number) => rect.y + rect.height * v / 700;
  await page.mouse.move(x(reverse ? 350 : 150), y(reverse ? 250 : 150));
  await page.mouse.down();
  await page.mouse.move(x(reverse ? 150 : 350), y(reverse ? 150 : 250), { steps: 5 });
  await expect(page.getByRole('status')).toContainText('200 × 100');
  await page.mouse.up();
  await expect(page.getByRole('dialog', { name: 'Review screenshot' })).toBeVisible();
}

test('uploaded PNG → reverse-drag sized crop → preview/comment → acknowledged webhook → MCP image', async ({ page }) => {
  await page.evaluate(() => navigator.clipboard.writeText('clipboard sentinel'));
  const before = (await createFileHistoryStore(historyPath).readHistory()).entries.length;
  await upload(page); await drag(page, true);
  const pixels = await page.getByAltText('Selected screenshot region').evaluate((img: HTMLImageElement) => {
    const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    return { width: canvas.width, height: canvas.height, center: [...canvas.getContext('2d')!.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data] };
  });
  expect(pixels).toEqual({ width: 200, height: 100, center: [255, 0, 0, 255] });
  expect((await createFileHistoryStore(historyPath).readHistory()).entries).toHaveLength(before);
  await page.getByRole('textbox', { name: 'Comment', exact: true }).fill('Make this region blue.');
  await page.screenshot({ path: 'test-results/screen-grab-preview.png' });
  await page.getByRole('button', { name: 'Send image + comment' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const history = await createFileHistoryStore(historyPath).readHistory();
  expect(history.entries).toHaveLength(before + 1);
  const entry = history.entries[0];
  expect(entry.context.screenGrab?.comment).toBe('Make this region blue.');
  expect(entry.context.screenGrab?.region).toEqual({ x: 150, y: 150, width: 200, height: 100 });
  const localHistory = await page.evaluate(() => (window as any).pg.getHistory());
  expect(localHistory).toHaveLength(1);
  expect(localHistory[0].context.screenGrab.data).toBe(entry.context.screenGrab!.data);
  const result = await client.callTool({ name: 'point_grab_get', arguments: { id: entry.id } });
  expect(result.content).toContainEqual({ type: 'image', mimeType: 'image/png', data: entry.context.screenGrab!.data });
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('clipboard sentinel');
  expect(await page.evaluate(() => (window as any).pg.isActive())).toBe(false);
});

test('Retake allows another file; Cancel and Escape never send', async ({ page }) => {
  const before = (await createFileHistoryStore(historyPath).readHistory()).entries.length;
  const png = await page.screenshot();
  await upload(page); await drag(page);
  await page.getByRole('button', { name: 'Retake' }).click();
  await page.getByLabel('Screenshot file').setInputFiles({ name: 'again.png', mimeType: 'image/png', buffer: png });
  await drag(page);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await open(page); await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await createFileHistoryStore(historyPath).readHistory()).entries).toHaveLength(before);
});

test('image paste is scoped to dialog; text paste and outside paste remain native', async ({ page }) => {
  const png = await page.screenshot();
  await page.evaluate(() => navigator.clipboard.writeText('native paste'));
  const input = page.getByRole('textbox', { name: 'Normal input' });
  await input.focus(); await page.keyboard.press('Control+v');
  await expect(input).toHaveValue('native paste');
  await input.blur(); await open(page);
  // OS clipboard image is exercised with real Clipboard API bytes and native Ctrl+V.
  await page.evaluate(async (bytes) => {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([new Uint8Array(bytes)], { type: 'image/png' }) })]);
  }, [...png]);
  await page.keyboard.press('Control+v');
  await expect(page.getByRole('dialog', { name: 'Drag a screenshot region' })).toBeVisible();
  await drag(page);
  await page.evaluate(() => navigator.clipboard.writeText('pasted comment'));
  await page.getByRole('textbox', { name: 'Comment', exact: true }).focus(); await page.keyboard.press('Control+v');
  await expect(page.getByRole('textbox', { name: 'Comment', exact: true })).toHaveValue('pasted comment');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
});

test('dropped PNG is decoded; invalid file recovers without sending', async ({ page }) => {
  const png = await page.screenshot();
  await open(page);
  await page.getByLabel('Screenshot file').setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('invalid image') });
  await expect(page.getByRole('alert')).toContainText('decode');
  await page.getByRole('dialog').evaluate((dialog, bytes) => {
    const data = new DataTransfer(); data.items.add(new File([new Uint8Array(bytes)], 'drop.png', { type: 'image/png' }));
    dialog.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
  }, [...png]);
  await expect(page.getByRole('dialog', { name: 'Drag a screenshot region' })).toBeVisible();
  await drag(page);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
});

test('selected-text Ctrl+C and input copy are native; existing Comment flow still copies', async ({ page }) => {
  await page.locator('#copy').evaluate((el) => { const range = document.createRange(); range.selectNodeContents(el); getSelection()!.removeAllRanges(); getSelection()!.addRange(range); });
  await page.keyboard.press('Control+c');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Normal copy still works');
  expect(await page.evaluate(() => (window as any).pg.isActive())).toBe(false);
  const normalInput = page.getByRole('textbox', { name: 'Normal input' });
  await normalInput.fill('Native input copy'); await normalInput.press('Control+a'); await page.keyboard.press('Control+c');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Native input copy');
  await normalInput.blur(); await page.evaluate(() => getSelection()!.removeAllRanges());
  await page.keyboard.press('Control+c');
  await page.getByRole('button', { name: 'Actions', exact: true }).click();
  await page.getByText('Add Comment', { exact: true }).click(); await page.locator('#target').click();
  await page.getByRole('dialog', { name: 'Add comment' }).getByRole('textbox').fill('Existing comment preserved');
  await page.getByRole('button', { name: 'Add to Review', exact: true }).click();
  await page.getByRole('button', { name: /Confirm & Copy/ }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Existing comment preserved');
});

test('failed transport retains preview/comment and retry requires acknowledgement', async ({ page }) => {
  const before = (await createFileHistoryStore(historyPath).readHistory()).entries.length;
  await page.route('http://localhost:3456/inspect', (route) => route.fulfill({ status: 503, headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' }));
  await upload(page); await drag(page);
  await page.getByRole('textbox', { name: 'Comment', exact: true }).fill('Keep me for retry');
  await page.getByRole('button', { name: 'Send image + comment' }).click();
  await expect(page.getByRole('status')).toContainText('503');
  await expect(page.getByRole('dialog', { name: 'Review screenshot' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Comment', exact: true })).toHaveValue('Keep me for retry');
  expect((await createFileHistoryStore(historyPath).readHistory()).entries).toHaveLength(before);
  await page.unroute('http://localhost:3456/inspect');
  await page.getByRole('button', { name: 'Send image + comment' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const history = await createFileHistoryStore(historyPath).readHistory();
  expect(history.entries).toHaveLength(before + 1);
  expect(history.entries[0].context.screenGrab?.comment).toBe('Keep me for retry');
});

test('tiny region stays in selection; missing image transport fails visibly', async ({ page }) => {
  await page.evaluate(() => (window as any).pg.unregisterPlugin('mcp-webhook'));
  await upload(page);
  const rect = (await page.getByLabel('Screenshot to crop').boundingBox())!;
  await page.mouse.move(rect.x + 10, rect.y + 10); await page.mouse.down(); await page.mouse.move(rect.x + 12, rect.y + 12); await page.mouse.up();
  await expect(page.getByRole('dialog', { name: 'Drag a screenshot region' })).toBeVisible();
  await drag(page);
  await page.getByRole('button', { name: 'Send image + comment' }).click();
  await expect(page.getByRole('status')).toContainText('exactly one image transport');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
});

test('legacy HTTP 200 without image acknowledgement retains preview and can Cancel', async ({ page }) => {
  const before = (await createFileHistoryStore(historyPath).readHistory()).entries.length;
  await page.route('http://localhost:3456/inspect', (route) => route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ success: true, id: 'legacy-text-only' }) }));
  await upload(page); await drag(page);
  await page.getByRole('button', { name: 'Send image + comment' }).click();
  await expect(page.getByRole('status')).toContainText('did not acknowledge image support');
  await expect(page.getByRole('dialog', { name: 'Review screenshot' })).toBeVisible();
  expect((await createFileHistoryStore(historyPath).readHistory()).entries).toHaveLength(before);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('pending Send cannot double-send or report completion before acknowledgement', async ({ page }) => {
  let release!: () => void;
  let requests = 0;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('http://localhost:3456/inspect', async (route) => { requests++; await gate; await route.continue(); });
  const before = (await createFileHistoryStore(historyPath).readHistory()).entries.length;
  await upload(page); await drag(page);
  await page.getByRole('button', { name: 'Send image + comment' }).click();
  await expect(page.getByRole('status')).toHaveText('Sending…');
  for (const name of ['Send image + comment', 'Retake', 'Cancel']) await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Review screenshot' })).toBeVisible();
  expect((await createFileHistoryStore(historyPath).readHistory()).entries).toHaveLength(before);
  release();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(requests).toBe(1);
  expect((await createFileHistoryStore(historyPath).readHistory()).entries).toHaveLength(before + 1);
});

test('queued existing comments survive opening and cancelling screenshot intake', async ({ page }) => {
  await page.keyboard.press('Control+c');
  await page.getByRole('button', { name: 'Actions', exact: true }).click();
  await page.getByText('Add Comment', { exact: true }).click(); await page.locator('#target').click();
  await page.getByRole('dialog', { name: 'Add comment' }).getByRole('textbox').fill('Do not lose queued comment');
  await page.getByRole('button', { name: 'Add to Review', exact: true }).click();
  await page.getByRole('button', { name: 'Actions', exact: true }).click();
  await page.getByText('Add screenshot', { exact: true }).click();
  await page.getByRole('dialog', { name: 'Add or paste a screenshot' }).getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: /Confirm & Copy/ }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Do not lose queued comment');
});

test('built core demo honestly exposes Add screenshot and Cancel restores normal UI', async ({ page }) => {
  await page.goto(`${url}/demo`);
  await page.getByRole('button', { name: 'Actions', exact: true }).click();
  await page.getByText('Add screenshot', { exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('system screenshot tool');
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Actions', exact: true })).toBeVisible();
});
