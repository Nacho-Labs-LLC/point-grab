import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
  ResourceListChangedNotificationSchema,
  ResourceUpdatedNotificationSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import type { GrabContext, GrabEntry, GrabHistory } from './types.js';

export const DEFAULT_HISTORY_PATH = join(homedir(), '.point-grab', 'history.json');
export const DEFAULT_WEBHOOK_PORT = 3456;

const RESOURCE_MIME_TYPE = 'application/json';
const CAPTURES_INDEX_URI = 'pointgrab://captures';
const LATEST_CAPTURE_URI = 'pointgrab://captures/latest';
const CAPTURE_BY_ID_TEMPLATE = 'pointgrab://captures/{captureId}';
const SESSION_CAPTURES_TEMPLATE = 'pointgrab://sessions/{sessionId}/captures';
const SESSION_LATEST_TEMPLATE = 'pointgrab://sessions/{sessionId}/captures/latest';
const SESSION_CAPTURE_BY_ID_TEMPLATE = 'pointgrab://sessions/{sessionId}/captures/{captureId}';
const CAPTURE_BY_ID_PATTERN = /^pointgrab:\/\/captures\/([^/]+)$/;
const SESSION_INDEX_PATTERN = /^pointgrab:\/\/sessions\/([^/]+)\/captures$/;
const SESSION_LATEST_PATTERN = /^pointgrab:\/\/sessions\/([^/]+)\/captures\/latest$/;
const SESSION_CAPTURE_BY_ID_PATTERN = /^pointgrab:\/\/sessions\/([^/]+)\/captures\/([^/]+)$/;
const MAX_LISTED_SESSIONS = 10;

type Audience = 'user' | 'assistant';

interface ResourceAnnotations {
  audience: Audience[];
  priority: number;
  lastModified?: string;
}

interface PointGrabResource {
  uri: string;
  name: string;
  title: string;
  description: string;
  mimeType: string;
  annotations: ResourceAnnotations;
}

interface PointGrabResourceTemplate {
  uriTemplate: string;
  name: string;
  title: string;
  description: string;
  mimeType: string;
  annotations: ResourceAnnotations;
}

export interface AddGrabResult {
  entry: GrabEntry;
  history: GrabHistory;
  resourcesListChanged: boolean;
}

export interface HistoryStore {
  ensureHistoryFile(): Promise<void>;
  readHistory(): Promise<GrabHistory>;
  addGrab(context: GrabContext, snippet: string): Promise<AddGrabResult>;
}

export interface CreatePointGrabMcpServerOptions {
  historyStore?: HistoryStore;
  historyPath?: string;
}

export interface PointGrabMcpServer {
  server: Server;
  historyStore: HistoryStore;
  addGrab(context: GrabContext, snippet: string): Promise<GrabEntry>;
  processIncomingGrab(data: unknown): Promise<GrabEntry>;
  startWebhookServer(port: number): HttpServer;
}

function createEmptyHistory(): GrabHistory {
  return { entries: [], maxEntries: 50 };
}

function isoTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function buildAnnotations(
  audience: Audience[],
  priority: number,
  lastModified?: string
): ResourceAnnotations {
  return lastModified
    ? { audience: [...audience], priority, lastModified }
    : { audience: [...audience], priority };
}

function getCaptureUri(captureId: string): string {
  return `pointgrab://captures/${encodeURIComponent(captureId)}`;
}

function getSessionIndexUri(sessionId: string): string {
  return `pointgrab://sessions/${encodeURIComponent(sessionId)}/captures`;
}

function getSessionLatestUri(sessionId: string): string {
  return `pointgrab://sessions/${encodeURIComponent(sessionId)}/captures/latest`;
}

function getSessionCaptureUri(sessionId: string, captureId: string): string {
  return `${getSessionIndexUri(sessionId)}/${encodeURIComponent(captureId)}`;
}

function formatEntry(entry: GrabEntry) {
  return {
    id: entry.id,
    timestamp: isoTimestamp(entry.timestamp),
    snippet: entry.snippet,
    context: {
      componentName: entry.context.componentName,
      filePath: entry.context.filePath,
      line: entry.context.line,
      column: entry.context.column,
      selector: entry.context.selector,
      cssClasses: entry.context.cssClasses,
      html: entry.context.html,
      componentStack: entry.context.componentStack,
      framework: entry.context.framework,
      sessionId: entry.context.sessionId ?? null,
      computedStyles: entry.context.computedStyles,
    },
  };
}

function getFrameworkBreakdown(history: GrabHistory): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of history.entries) {
    const framework = entry.context.framework ?? 'unknown';
    counts[framework] = (counts[framework] || 0) + 1;
  }
  return counts;
}

function getHistoryLastModified(history: GrabHistory): string | undefined {
  return history.entries[0] ? isoTimestamp(history.entries[0].timestamp) : undefined;
}

function getSessionEntries(history: GrabHistory, sessionId: string): GrabEntry[] {
  return history.entries.filter((entry) => entry.context.sessionId === sessionId);
}

function getSessionLastModified(
  history: GrabHistory,
  sessionId: string
): string | undefined {
  return getSessionEntries(history, sessionId)[0]
    ? isoTimestamp(getSessionEntries(history, sessionId)[0].timestamp)
    : undefined;
}

function listKnownSessionIds(history: GrabHistory): string[] {
  const sessionIds: string[] = [];
  const seen = new Set<string>();

  for (const entry of history.entries) {
    const sessionId = entry.context.sessionId ?? null;
    if (!sessionId || seen.has(sessionId)) {
      continue;
    }

    seen.add(sessionId);
    sessionIds.push(sessionId);

    if (sessionIds.length >= MAX_LISTED_SESSIONS) {
      break;
    }
  }

  return sessionIds;
}

function arraysEqual(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function buildIndexResource(
  uri: string,
  title: string,
  description: string,
  lastModified?: string
): PointGrabResource {
  return {
    uri,
    name: 'capture_history',
    title,
    description,
    mimeType: RESOURCE_MIME_TYPE,
    annotations: buildAnnotations(['user'], 0.35, lastModified),
  };
}

function buildCaptureResource(
  uri: string,
  entry: GrabEntry,
  title = 'Latest Capture'
): PointGrabResource {
  const label = entry.context.componentName ?? entry.context.selector ?? entry.id;
  return {
    uri,
    name: 'capture_artifact',
    title,
    description: `Capture artifact for ${label}`,
    mimeType: RESOURCE_MIME_TYPE,
    annotations: buildAnnotations(['user', 'assistant'], 0.95, isoTimestamp(entry.timestamp)),
  };
}

function buildListedResources(history: GrabHistory): PointGrabResource[] {
  const resources: PointGrabResource[] = [
    buildIndexResource(
      CAPTURES_INDEX_URI,
      'Capture History',
      'Browse the persisted point-grab capture history index.',
      getHistoryLastModified(history)
    ),
  ];

  if (history.entries[0]) {
    resources.push(buildCaptureResource(LATEST_CAPTURE_URI, history.entries[0]));
  }

  for (const sessionId of listKnownSessionIds(history)) {
    resources.push(
      buildIndexResource(
        getSessionIndexUri(sessionId),
        `Session ${sessionId} Captures`,
        `Browse the persisted capture history for session "${sessionId}".`,
        getSessionLastModified(history, sessionId)
      )
    );
  }

  return resources;
}

function buildResourceTemplates(history: GrabHistory): PointGrabResourceTemplate[] {
  const lastModified = getHistoryLastModified(history);

  return [
    {
      uriTemplate: CAPTURE_BY_ID_TEMPLATE,
      name: 'capture_by_id',
      title: 'Capture By ID',
      description: 'Read a specific point-grab capture artifact by capture ID.',
      mimeType: RESOURCE_MIME_TYPE,
      annotations: buildAnnotations(['user', 'assistant'], 0.9, lastModified),
    },
    {
      uriTemplate: SESSION_CAPTURES_TEMPLATE,
      name: 'session_capture_history',
      title: 'Session Capture History',
      description: 'Read the capture history index for a sender-defined session ID.',
      mimeType: RESOURCE_MIME_TYPE,
      annotations: buildAnnotations(['user'], 0.3, lastModified),
    },
    {
      uriTemplate: SESSION_LATEST_TEMPLATE,
      name: 'session_latest_capture',
      title: 'Session Latest Capture',
      description: 'Read the most recent capture artifact for a sender-defined session ID.',
      mimeType: RESOURCE_MIME_TYPE,
      annotations: buildAnnotations(['user', 'assistant'], 0.85, lastModified),
    },
    {
      uriTemplate: SESSION_CAPTURE_BY_ID_TEMPLATE,
      name: 'session_capture_by_id',
      title: 'Session Capture By ID',
      description:
        'Read a specific capture artifact by capture ID within a sender-defined session.',
      mimeType: RESOURCE_MIME_TYPE,
      annotations: buildAnnotations(['user', 'assistant'], 0.8, lastModified),
    },
  ];
}

function toResourceLink(resource: PointGrabResource) {
  return { ...resource, type: 'resource_link' as const };
}

function buildHistoryIndexPayload(
  history: GrabHistory,
  entries: GrabEntry[],
  uri: string,
  sessionId?: string
) {
  return {
    resource: uri,
    scope: sessionId ? { sessionId } : { sessionId: null },
    totalCaptures: entries.length,
    maxEntries: history.maxEntries,
    mostRecentCapture: entries[0] ? isoTimestamp(entries[0].timestamp) : null,
    captures: entries.map((entry) => ({
      id: entry.id,
      timestamp: isoTimestamp(entry.timestamp),
      componentName: entry.context.componentName,
      selector: entry.context.selector,
      filePath: entry.context.filePath,
      framework: entry.context.framework,
      sessionId: entry.context.sessionId ?? null,
      uri: sessionId
        ? getSessionCaptureUri(sessionId, entry.id)
        : getCaptureUri(entry.id),
    })),
  };
}

function resolveResourcePayload(history: GrabHistory, uri: string) {
  if (uri === CAPTURES_INDEX_URI) {
    return buildHistoryIndexPayload(history, history.entries, CAPTURES_INDEX_URI);
  }

  if (uri === LATEST_CAPTURE_URI) {
    if (!history.entries[0]) {
      throw new McpError(ErrorCode.InvalidRequest, 'No captures have been persisted yet');
    }

    return {
      resource: LATEST_CAPTURE_URI,
      ...formatEntry(history.entries[0]),
    };
  }

  const sessionLatestMatch = uri.match(SESSION_LATEST_PATTERN);
  if (sessionLatestMatch) {
    const sessionId = decodeURIComponent(sessionLatestMatch[1]);
    const entry = getSessionEntries(history, sessionId)[0];

    if (!entry) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `No captures found for session "${sessionId}"`
      );
    }

    return {
      resource: getSessionLatestUri(sessionId),
      sessionId,
      ...formatEntry(entry),
    };
  }

  const sessionCaptureMatch = uri.match(SESSION_CAPTURE_BY_ID_PATTERN);
  if (sessionCaptureMatch) {
    const sessionId = decodeURIComponent(sessionCaptureMatch[1]);
    const captureId = decodeURIComponent(sessionCaptureMatch[2]);
    const entry = history.entries.find(
      (candidate) =>
        candidate.id === captureId && candidate.context.sessionId === sessionId
    );

    if (!entry) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Capture "${captureId}" not found in session "${sessionId}"`
      );
    }

    return {
      resource: getSessionCaptureUri(sessionId, captureId),
      sessionId,
      ...formatEntry(entry),
    };
  }

  const sessionIndexMatch = uri.match(SESSION_INDEX_PATTERN);
  if (sessionIndexMatch) {
    const sessionId = decodeURIComponent(sessionIndexMatch[1]);
    const entries = getSessionEntries(history, sessionId);

    return buildHistoryIndexPayload(
      history,
      entries,
      getSessionIndexUri(sessionId),
      sessionId
    );
  }

  const captureByIdMatch = uri.match(CAPTURE_BY_ID_PATTERN);
  if (captureByIdMatch) {
    const captureId = decodeURIComponent(captureByIdMatch[1]);
    const entry = history.entries.find((candidate) => candidate.id === captureId);

    if (!entry) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Grab entry with ID "${captureId}" not found`
      );
    }

    return {
      resource: getCaptureUri(captureId),
      ...formatEntry(entry),
    };
  }

  throw new McpError(ErrorCode.InvalidRequest, `Unsupported resource URI "${uri}"`);
}

function searchHistory(
  history: GrabHistory,
  query?: string,
  componentName?: string,
  filePath?: string,
  framework?: string,
  limit = 10
): GrabEntry[] {
  let results = [...history.entries];

  if (query) {
    const normalizedQuery = query.toLowerCase();
    results = results.filter(
      (entry) =>
        entry.context.html.toLowerCase().includes(normalizedQuery) ||
        (entry.context.componentName?.toLowerCase().includes(normalizedQuery) ?? false) ||
        (entry.context.filePath?.toLowerCase().includes(normalizedQuery) ?? false) ||
        entry.context.selector.toLowerCase().includes(normalizedQuery) ||
        (entry.context.framework?.toLowerCase().includes(normalizedQuery) ?? false) ||
        (entry.context.sessionId?.toLowerCase().includes(normalizedQuery) ?? false)
    );
  }

  if (componentName) {
    const normalizedComponent = componentName.toLowerCase();
    results = results.filter(
      (entry) =>
        entry.context.componentName?.toLowerCase().includes(normalizedComponent) ?? false
    );
  }

  if (filePath) {
    const normalizedPath = filePath.toLowerCase();
    results = results.filter(
      (entry) => entry.context.filePath?.toLowerCase().includes(normalizedPath) ?? false
    );
  }

  if (framework) {
    const normalizedFramework = framework.toLowerCase();
    results = results.filter(
      (entry) => entry.context.framework?.toLowerCase() === normalizedFramework
    );
  }

  results.sort((left, right) => right.timestamp - left.timestamp);
  return results.slice(0, Math.max(0, limit));
}

function buildCaptureLinks(history: GrabHistory, entries: GrabEntry[], includeLatestAlias: boolean) {
  const links = [
    toResourceLink(buildIndexResource(
      CAPTURES_INDEX_URI,
      'Capture History',
      'Browse the persisted point-grab capture history index.',
      getHistoryLastModified(history)
    )),
  ];

  if (includeLatestAlias && history.entries[0]) {
    links.push(toResourceLink(buildCaptureResource(LATEST_CAPTURE_URI, history.entries[0])));
  }

  for (const entry of entries) {
    links.push(
      toResourceLink(
        buildCaptureResource(getCaptureUri(entry.id), entry, `Capture ${entry.id}`)
      )
    );
  }

  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.uri)) {
      return false;
    }

    seen.add(link.uri);
    return true;
  });
}

function buildToolResult(payload: unknown, resourceLinks: ReturnType<typeof buildCaptureLinks> = []) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(payload, null, 2),
      },
      ...resourceLinks,
    ],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function readStringRecord(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string'
  );

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

function readComponentStack(
  value: unknown
): GrabContext['componentStack'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((entry) => ({
      name: readString(entry.name) ?? '',
      filePath: readNullableString(entry.filePath),
      line: readNullableNumber(entry.line),
      column: readNullableNumber(entry.column),
    }));
}

function parseIncomingGrab(data: unknown) {
  if (!isRecord(data)) {
    throw new Error('Invalid grab payload');
  }

  const html = readNonEmptyString(data.html);
  const componentName = readNullableString(data.componentName);

  if (!html) {
    throw new Error('Missing required field: html');
  }

  const computedStyles = readStringRecord(data.computedStyles);

  return {
    snippet: readString(data.snippet) ?? '',
    context: {
      html,
      componentName,
      filePath: readNullableString(data.filePath),
      line: readNullableNumber(data.line),
      column: readNullableNumber(data.column),
      selector: readString(data.selector) ?? '',
      cssClasses: readStringArray(data.cssClasses),
      componentStack: readComponentStack(data.componentStack),
      textContent: readNullableString(data.textContent),
      ariaLabel: readNullableString(data.ariaLabel),
      role: readNullableString(data.role),
      elementDescription: readNullableString(data.elementDescription),
      framework: readNullableString(data.framework),
      sessionId: readNullableString(data.sessionId),
      computedStyles,
    } satisfies GrabContext,
  };
}

function isSupportedResourceUri(uri: string): boolean {
  return (
    uri === CAPTURES_INDEX_URI ||
    uri === LATEST_CAPTURE_URI ||
    CAPTURE_BY_ID_PATTERN.test(uri) ||
    SESSION_INDEX_PATTERN.test(uri) ||
    SESSION_LATEST_PATTERN.test(uri) ||
    SESSION_CAPTURE_BY_ID_PATTERN.test(uri)
  );
}

function startWebhookServer(
  port: number,
  processIncomingGrab: (data: unknown) => Promise<GrabEntry>
): HttpServer {
  const httpServer = createHttpServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== 'POST' || (req.url !== '/inspect' && req.url !== '/grab')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    const maxBodySize = 1024 * 512;
    let body = '';
    let overflow = false;

    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
      if (body.length > maxBodySize) {
        overflow = true;
        req.destroy();
      }
    });

    req.on('end', async () => {
      if (overflow) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload too large' }));
        return;
      }

      try {
        const entry = await processIncomingGrab(JSON.parse(body));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, id: entry.id }));

        const framework = entry.context.framework ? ` [${entry.context.framework}]` : '';
        console.error(
          `[point-grab] Grabbed: ${entry.context.componentName}${framework} at ${entry.context.filePath ?? 'unknown'}:${entry.context.line ?? '?'}`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        const statusCode = message.startsWith('Missing required field') ? 400 : 500;
        console.error('[point-grab] Failed to process grab:', error);
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: message }));
      }
    });
  });

  httpServer.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `[point-grab] Port ${port} already in use. Webhook disabled — MCP resources and tools still work, but new grabs won't be received.`
      );
      console.error('[point-grab] To use a different port, set POINT_GRAB_PORT env variable.');
      return;
    }

    console.error('[point-grab] Webhook server error:', error);
  });

  httpServer.listen(port, () => {
    console.error(`[point-grab] Webhook listener on http://localhost:${port}/inspect`);
  });

  return httpServer;
}

export function createFileHistoryStore(historyPath = DEFAULT_HISTORY_PATH): HistoryStore {
  let cachedHistory: GrabHistory | null = null;
  let writeQueue: Promise<void> = Promise.resolve();

  async function ensureHistoryFile(): Promise<void> {
    const exists = await stat(historyPath).catch(() => null);
    if (exists) {
      return;
    }

    await mkdir(dirname(historyPath), { recursive: true });
    await writeFile(historyPath, JSON.stringify(createEmptyHistory(), null, 2));
  }

  async function readHistory(): Promise<GrabHistory> {
    if (cachedHistory) {
      return cachedHistory;
    }

    try {
      const content = await readFile(historyPath, 'utf-8');
      cachedHistory = JSON.parse(content) as GrabHistory;
      return cachedHistory;
    } catch {
      return createEmptyHistory();
    }
  }

  async function addGrab(context: GrabContext, snippet: string): Promise<AddGrabResult> {
    let result: AddGrabResult | null = null;

    writeQueue = writeQueue.then(async () => {
      cachedHistory = null;
      const history = await readHistory();
      const previousSessionIds = listKnownSessionIds(history);

      const entry: GrabEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        context,
        snippet,
        timestamp: Date.now(),
      };

      const nextHistory: GrabHistory = {
        ...history,
        entries: [entry, ...history.entries].slice(0, history.maxEntries),
      };

      await writeFile(historyPath, JSON.stringify(nextHistory, null, 2));
      cachedHistory = nextHistory;

      const nextSessionIds = listKnownSessionIds(nextHistory);
      result = {
        entry,
        history: nextHistory,
        resourcesListChanged:
          history.entries.length === 0 || !arraysEqual(previousSessionIds, nextSessionIds),
      };
    });

    await writeQueue;

    if (!result) {
      throw new Error('Failed to persist grab entry');
    }

    return result;
  }

  return {
    ensureHistoryFile,
    readHistory,
    addGrab,
  };
}

export function createPointGrabMcpServer(
  options: CreatePointGrabMcpServerOptions = {}
): PointGrabMcpServer {
  const historyStore =
    options.historyStore ??
    createFileHistoryStore(options.historyPath ?? DEFAULT_HISTORY_PATH);
  const subscribedUris = new Set<string>();

  const server = new Server(
    {
      name: 'point-grab-mcp',
      version: '0.1.6',
    },
    {
      capabilities: {
        tools: {},
        resources: {
          subscribe: true,
          listChanged: true,
        },
      },
    }
  );

  async function notifyResourceChanges(result: AddGrabResult): Promise<void> {
    const candidateUris = [
      CAPTURES_INDEX_URI,
      LATEST_CAPTURE_URI,
      getCaptureUri(result.entry.id),
    ];

    const sessionId = result.entry.context.sessionId ?? null;
    if (sessionId) {
      candidateUris.push(
        getSessionIndexUri(sessionId),
        getSessionLatestUri(sessionId),
        getSessionCaptureUri(sessionId, result.entry.id)
      );
    }

    for (const uri of candidateUris) {
      if (!subscribedUris.has(uri)) {
        continue;
      }

      await server.sendResourceUpdated({ uri });
    }

    if (result.resourcesListChanged) {
      await server.sendResourceListChanged();
    }
  }

  async function addGrab(context: GrabContext, snippet: string): Promise<GrabEntry> {
    const result = await historyStore.addGrab(context, snippet);
    await notifyResourceChanges(result);
    return result.entry;
  }

  async function processIncomingGrab(data: unknown): Promise<GrabEntry> {
    const parsed = parseIncomingGrab(data);
    return addGrab(parsed.context, parsed.snippet);
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'point_grab_search',
        description:
          'Search point-grab history. Query grabbed elements by text, component name, file path, framework, or session. Returns matching elements with HTML, component info, and stack trace.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            query: {
              type: 'string',
              description:
                'Search term (searches in HTML, component name, file path, selector, framework, and session ID)',
            },
            componentName: {
              type: 'string',
              description: 'Filter by component name (partial match)',
            },
            filePath: {
              type: 'string',
              description: 'Filter by file path (partial match)',
            },
            framework: {
              type: 'string',
              description:
                'Filter by framework (exact match, e.g. "angular", "react", "vue", "svelte", "web-components", "vanilla")',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (default: 10)',
              default: 10,
            },
          },
        },
      },
      {
        name: 'point_grab_recent',
        description:
          'Get the most recent grabbed elements. Returns the latest N inspected elements from history.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            limit: {
              type: 'number',
              description: 'Number of recent grabs to return (default: 5)',
              default: 5,
            },
          },
        },
      },
      {
        name: 'point_grab_get',
        description:
          'Get a specific grabbed element by ID. Returns the full context for a single grab entry.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            id: {
              type: 'string',
              description: 'The grab entry ID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'point_grab_stats',
        description:
          'Get statistics about point-grab history. Returns total grabs, unique components, unique files, per-framework breakdown, and recent activity.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
        },
      },
      {
        name: 'point_grab_frameworks',
        description:
          'Get a summary of which frameworks have been detected in the grab history. Returns grab counts grouped by framework.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
        },
      },
    ],
  }));

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const history = await historyStore.readHistory();
    return { resources: buildListedResources(history) };
  });

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    const history = await historyStore.readHistory();
    return { resourceTemplates: buildResourceTemplates(history) };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const history = await historyStore.readHistory();
    const payload = resolveResourcePayload(history, request.params.uri);

    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: RESOURCE_MIME_TYPE,
          text: JSON.stringify(payload, null, 2),
        },
      ],
    };
  });

  server.setRequestHandler(SubscribeRequestSchema, async (request) => {
    const { uri } = request.params;
    if (!isSupportedResourceUri(uri)) {
      throw new McpError(ErrorCode.InvalidRequest, `Unsupported resource URI "${uri}"`);
    }

    subscribedUris.add(uri);
    return {};
  });

  server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
    subscribedUris.delete(request.params.uri);
    return {};
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;

    try {
      const history = await historyStore.readHistory();

      switch (name) {
        case 'point_grab_search': {
          const args = (rawArgs ?? {}) as {
            query?: string;
            componentName?: string;
            filePath?: string;
            framework?: string;
            limit?: number;
          };
          const results = searchHistory(
            history,
            args.query,
            args.componentName,
            args.filePath,
            args.framework,
            args.limit ?? 10
          );

          return buildToolResult(
            { total: results.length, results: results.map(formatEntry) },
            buildCaptureLinks(history, results, false)
          );
        }

        case 'point_grab_recent': {
          const args = (rawArgs ?? {}) as { limit?: number };
          const recent = searchHistory(
            history,
            undefined,
            undefined,
            undefined,
            undefined,
            args.limit ?? 5
          );

          return buildToolResult(
            { total: recent.length, results: recent.map(formatEntry) },
            buildCaptureLinks(history, recent, true)
          );
        }

        case 'point_grab_get': {
          const args = (rawArgs ?? {}) as { id?: string };
          if (!args.id) {
            throw new McpError(ErrorCode.InvalidRequest, 'Tool requires an "id" argument');
          }

          const entry = history.entries.find((candidate) => candidate.id === args.id);

          if (!entry) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Grab entry with ID "${args.id}" not found`
            );
          }

          return buildToolResult(
            formatEntry(entry),
            buildCaptureLinks(history, [entry], history.entries[0]?.id === entry.id)
          );
        }

        case 'point_grab_stats': {
          const uniqueComponents = new Set(
            history.entries.map((entry) => entry.context.componentName).filter(Boolean)
          );
          const uniqueFiles = new Set(
            history.entries.map((entry) => entry.context.filePath).filter(Boolean)
          );
          const now = Date.now();
          const last24Hours = history.entries.filter(
            (entry) => now - entry.timestamp < 24 * 60 * 60 * 1000
          ).length;
          const last7Days = history.entries.filter(
            (entry) => now - entry.timestamp < 7 * 24 * 60 * 60 * 1000
          ).length;

          return buildToolResult({
            totalGrabs: history.entries.length,
            uniqueComponents: uniqueComponents.size,
            uniqueFiles: uniqueFiles.size,
            maxEntries: history.maxEntries,
            frameworks: getFrameworkBreakdown(history),
            recentActivity: {
              last24Hours,
              last7Days,
            },
            mostRecentGrab: history.entries[0]
              ? isoTimestamp(history.entries[0].timestamp)
              : null,
          });
        }

        case 'point_grab_frameworks':
          return buildToolResult({
            totalGrabs: history.entries.length,
            frameworks: getFrameworkBreakdown(history),
          });

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      throw new McpError(
        ErrorCode.InternalError,
        `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  });

  return {
    server,
    historyStore,
    addGrab,
    processIncomingGrab,
    startWebhookServer: (port: number) => startWebhookServer(port, processIncomingGrab),
  };
}

export async function main(): Promise<void> {
  const historyPath = process.env.POINT_GRAB_HISTORY_PATH ?? DEFAULT_HISTORY_PATH;
  const webhookPort = Number.parseInt(
    process.env.POINT_GRAB_PORT ?? String(DEFAULT_WEBHOOK_PORT),
    10
  );

  const pointGrabServer = createPointGrabMcpServer({ historyPath });
  await pointGrabServer.historyStore.ensureHistoryFile();
  pointGrabServer.startWebhookServer(webhookPort);

  const transport = new StdioServerTransport();
  await pointGrabServer.server.connect(transport);

  console.error('[point-grab] MCP server running');
  console.error(`[point-grab] History: ${historyPath}`);
}
