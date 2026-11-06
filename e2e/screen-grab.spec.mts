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
  // Fail rather than send test data to an unrelated existing service.
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
  // Explicit fallback: real MediaStream/video/canvas, NOT native permissions or tab pixels.
  if (process.env.POINT_GRAB_TEST_CAPTURE === 'canvas') await page.evaluate(() => {
    (window as any).__captureTracks = [];
    navigator.mediaDevices.getDisplayMedia = async () => {
      const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 700;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1000, 700);
      ctx.fillStyle = '#f00'; ctx.fillRect(100, 100, 300, 200);
      const stream = canvas.captureStream(30);
      for (const track of stream.getVideoTracks()) {
        const settings = track.getSettings.bind(track);
        track.getSettings = () => ({ ...settings(), displaySurface: 'browser' });
        (window as any).__captureTracks.push(track);
      }
      return stream;
    };
  });
});
test.afterEach(() => { expect(errors).toEqual([]); });

async function open(page: Page) {
  await page.keyboard.press('Control+c');
  await page.getByRole('button', { name: 'Screen Grab', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Screen Grab', exact: true })).toBeVisible();
}
async function capture(page: Page) {
  await page.getByRole('button', { name: 'Start sharing', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Drag a screenshot region' })).toBeVisible({ timeout: 15000 });
}
async function drag(page: Page, reverse = false) {
  await page.mouse.move(reverse ? 350 : 150, reverse ? 250 : 150);
  await page.mouse.down();
  await page.mouse.move(reverse ? 150 : 350, reverse ? 150 : 250, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole('dialog', { name: 'Review Screen Grab' })).toBeVisible();
}

test(`explicit ${process.env.POINT_GRAB_TEST_CAPTURE === 'canvas' ? 'canvas-stream (permission stub)' : 'native tab'} capture → reverse-drag crop → preview → image/comment webhook → MCP image`, async ({ page }) => {
  await page.evaluate(() => navigator.clipboard.writeText('clipboard sentinel'));
  await open(page);
  expect((await createFileHistoryStore(historyPath).readHistory()).entries).toHaveLength(0);
  await capture(page);
  await drag(page, true);
  if (process.env.POINT_GRAB_TEST_CAPTURE === 'canvas') expect(await page.evaluate(() => (window as any).__captureTracks.every((track: MediaStreamTrack) => track.readyState === 'ended'))).toBe(true);
  const pixels = await page.getByAltText('Selected screenshot region').evaluate((img: HTMLImageElement) => {
    const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    return { width: canvas.width, height: canvas.height, center: [...canvas.getContext('2d')!.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data] };
  });
  expect(pixels).toEqual({ width: 200, height: 100, center: [255, 0, 0, 255] });
  expect((await createFileHistoryStore(historyPath).readHistory()).entries).toHaveLength(0);
  await page.getByRole('textbox', { name: 'Comment', exact: true }).fill('Make this region blue.');
  await page.screenshot({ path: 'test-results/screen-grab-preview.png' });
  await page.getByRole('button', { name: 'Send image + comment' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const history = await createFileHistoryStore(historyPath).readHistory();
  expect(history.entries).toHaveLength(1);
  expect(history.entries[0].context.screenGrab?.comment).toBe('Make this region blue.');
  const result = await client.callTool({ name: 'point_grab_get', arguments: { id: history.entries[0].id } });
  expect(result.content).toContainEqual({ type: 'image', mimeType: 'image/png', data: history.entries[0].context.screenGrab!.data });
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('clipboard sentinel');
  expect(await page.evaluate(() => (window as any).pg.isActive())).toBe(false);
});

test('retake requires another explicit permission click; Cancel never sends', async ({ page }) => {
  const before = (await createFileHistoryStore(historyPath).readHistory()).entries.length;
  await open(page); await capture(page); await drag(page);
  await page.getByRole('button', { name: 'Retake' }).click();
  await expect(page.getByRole('button', { name: 'Start sharing' })).toBeVisible();
  await capture(page); await drag(page);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await createFileHistoryStore(historyPath).readHistory()).entries).toHaveLength(before);
});

test('permission denial and unsupported capture remain recoverable without sending', async ({ page }) => {
  await page.evaluate(() => { navigator.mediaDevices.getDisplayMedia = async () => { throw new DOMException('Permission denied', 'NotAllowedError'); }; });
  await open(page);
  await page.getByRole('button', { name: 'Start sharing' }).click();
  await expect(page.getByRole('alert')).toContainText('Permission denied');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.evaluate(() => { Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', { value: undefined }); });
  await open(page);
  await page.getByRole('button', { name: 'Start sharing' }).click();
  await expect(page.getByRole('alert')).toContainText('secure context');
});

test('selected-text Ctrl+C and input copy are native; existing Comment flow still copies', async ({ page }) => {
  await page.locator('#copy').evaluate((el) => { const range = document.createRange(); range.selectNodeContents(el); getSelection()!.removeAllRanges(); getSelection()!.addRange(range); });
  await page.keyboard.press('Control+c');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Normal copy still works');
  expect(await page.evaluate(() => (window as any).pg.isActive())).toBe(false);
  const normalInput = page.getByRole('textbox', { name: 'Normal input' });
  await normalInput.fill('Native input copy');
  await normalInput.press('Control+a');
  await page.keyboard.press('Control+c');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Native input copy');
  await normalInput.evaluate((element: HTMLTextAreaElement) => element.blur());
  await page.evaluate(() => getSelection()!.removeAllRanges());
  await page.keyboard.press('Control+c');
  await page.getByRole('button', { name: 'Actions', exact: true }).click();
  await page.getByText('Add Comment', { exact: true }).click();
  await page.locator('#target').click();
  await page.getByRole('dialog', { name: 'Add comment' }).getByRole('textbox').fill('Existing comment preserved');
  await page.getByRole('button', { name: 'Add to Review', exact: true }).click();
  await page.getByRole('button', { name: /Confirm & Copy/ }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Existing comment preserved');
});

test('failed image transport keeps the preview and never reports success', async ({ page }) => {
  const before = (await createFileHistoryStore(historyPath).readHistory()).entries.length;
  await page.route('http://localhost:3456/inspect', (route) => route.fulfill({ status: 503, headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' }));
  await open(page); await capture(page); await drag(page);
  await page.getByRole('textbox', { name: 'Comment', exact: true }).fill('Keep me for retry');
  await page.getByRole('button', { name: 'Send image + comment' }).click();
  await expect(page.getByRole('status')).toContainText('503');
  await expect(page.getByRole('dialog', { name: 'Review Screen Grab' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Comment', exact: true })).toHaveValue('Keep me for retry');
  expect((await createFileHistoryStore(historyPath).readHistory()).entries).toHaveLength(before);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
});

test('tiny region stays in selection; missing image transport fails visibly', async ({ page }) => {
  await page.evaluate(() => (window as any).pg.unregisterPlugin('mcp-webhook'));
  await open(page); await capture(page);
  await page.mouse.move(150, 150); await page.mouse.down(); await page.mouse.move(152, 152); await page.mouse.up();
  await expect(page.getByRole('dialog', { name: 'Drag a screenshot region' })).toBeVisible();
  await drag(page);
  await page.getByRole('button', { name: 'Send image + comment' }).click();
  await expect(page.getByRole('status')).toContainText('exactly one image transport');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
});

test('built core demo exposes Screen Grab and Cancel restores normal UI', async ({ page }) => {
  await page.goto(`${url}/demo`);
  await page.getByRole('button', { name: 'Screen Grab', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Choose this tab');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Actions', exact: true })).toBeVisible();
});
