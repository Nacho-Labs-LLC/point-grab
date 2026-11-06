import { afterEach, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { createPointGrabMcpServer, createFileHistoryStore } from '../server.js';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const grab = { mimeType: 'image/png', data: png, width: 1, height: 1, region: { x: 12, y: 20, width: 8, height: 8 }, comment: 'Fix this layout' };
let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => { const run = cleanup; cleanup = undefined; await run?.(); });

it('POSTs PNG + comment, persists them, and returns a real MCP image block', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'point-grab-image-'));
  const historyPath = join(directory, 'history.json');
  const app = createPointGrabMcpServer({ historyPath });
  await app.historyStore.ensureHistoryFile();
  const client = new Client({ name: 'image-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(a), app.server.connect(b)]);
  const http = app.startWebhookServer(0);
  cleanup = async () => { await client.close(); await new Promise<void>((resolve) => http.close(() => resolve())); await rm(directory, { recursive: true, force: true }); };
  await once(http, 'listening');
  const address = http.address() as { port: number };
  const response = await fetch(`http://127.0.0.1:${address.port}/inspect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html: '<!-- Screen Grab -->', screenGrab: grab, snippet: grab.comment }) });
  expect(response.status).toBe(200);
  const { id } = await response.json();
  const persisted = await createFileHistoryStore(historyPath).readHistory();
  expect(persisted.entries[0].context).toHaveProperty('screenGrab', grab);
  const result = await client.callTool({ name: 'point_grab_get', arguments: { id } });
  expect(result.content).toContainEqual({ type: 'image', data: png, mimeType: 'image/png' });
  expect(JSON.stringify(result.content)).toContain('Fix this layout');
  const found = await client.callTool({ name: 'point_grab_search', arguments: { query: 'Fix this layout' } });
  expect(JSON.stringify(found.content)).toContain(id);
  const resource = await client.readResource({ uri: `pointgrab://captures/${id}` });
  expect(JSON.stringify(resource.contents)).toContain(png);
});

it('rejects malformed PNG payloads rather than silently dropping images', async () => {
  const app = createPointGrabMcpServer({ historyStore: {
    async ensureHistoryFile() {},
    async readHistory() { return { entries: [], maxEntries: 50 }; },
    async addGrab() { throw new Error('Malformed image must never reach persistence'); },
  } });
  await expect(app.processIncomingGrab({ html: '<!-- Screen Grab -->', screenGrab: { ...grab, data: 'not-a-png' } })).rejects.toThrow('Invalid Screen Grab');
});
