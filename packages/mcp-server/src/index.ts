import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import type { GrabEntry, GrabHistory } from './types.js';

const DEFAULT_HISTORY_PATH = join(homedir(), '.point-grab', 'history.json');
const DEFAULT_WEBHOOK_PORT = 3456;

let historyPath = DEFAULT_HISTORY_PATH;
let cachedHistory: GrabHistory | null = null;

async function ensureHistoryFile(): Promise<void> {
  try {
    const exists = await stat(historyPath).catch(() => null);
    if (!exists) {
      await mkdir(dirname(historyPath), { recursive: true });
      const initial: GrabHistory = { entries: [], maxEntries: 50 };
      await writeFile(historyPath, JSON.stringify(initial, null, 2));
    }
  } catch (error) {
    console.error('Failed to ensure history file:', error);
  }
}

async function readHistory(): Promise<GrabHistory> {
  if (cachedHistory) {
    return cachedHistory;
  }

  try {
    const content = await readFile(historyPath, 'utf-8');
    const data = JSON.parse(content) as GrabHistory;
    cachedHistory = data;
    return data;
  } catch {
    return { entries: [], maxEntries: 50 };
  }
}

// Serialize writes to prevent concurrent read-modify-write data loss
let writeQueue: Promise<void> = Promise.resolve();

async function addGrab(context: GrabEntry['context'], snippet: string): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    // Always read fresh from disk inside the serialized queue
    cachedHistory = null;
    const history = await readHistory();

    const newEntry: GrabEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      context,
      snippet,
      timestamp: Date.now(),
    };

    history.entries = [newEntry, ...history.entries].slice(0, history.maxEntries);
    await writeFile(historyPath, JSON.stringify(history, null, 2));
    cachedHistory = history;
  });
  await writeQueue;
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
    const q = query.toLowerCase();
    results = results.filter(
      (entry) =>
        entry.context.html.toLowerCase().includes(q) ||
        (entry.context.componentName?.toLowerCase().includes(q) ?? false) ||
        (entry.context.filePath?.toLowerCase().includes(q) ?? false) ||
        entry.context.selector.toLowerCase().includes(q) ||
        (entry.context.framework?.toLowerCase().includes(q) ?? false)
    );
  }

  if (componentName) {
    const cn = componentName.toLowerCase();
    results = results.filter((entry) =>
      entry.context.componentName?.toLowerCase().includes(cn) ?? false
    );
  }

  if (filePath) {
    const fp = filePath.toLowerCase();
    results = results.filter((entry) =>
      entry.context.filePath?.toLowerCase().includes(fp) ?? false
    );
  }

  if (framework) {
    const fw = framework.toLowerCase();
    results = results.filter((entry) =>
      entry.context.framework?.toLowerCase() === fw
    );
  }

  results.sort((a, b) => b.timestamp - a.timestamp);
  return results.slice(0, Math.max(0, limit));
}

function formatEntry(entry: GrabEntry) {
  return {
    id: entry.id,
    timestamp: new Date(entry.timestamp).toISOString(),
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
      computedStyles: entry.context.computedStyles,
    },
  };
}

function getFrameworkBreakdown(history: GrabHistory): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of history.entries) {
    const fw = entry.context.framework ?? 'unknown';
    counts[fw] = (counts[fw] || 0) + 1;
  }
  return counts;
}

// -- HTTP server (receives grabs from browser) --

function startWebhookServer(port: number): void {
  const httpServer = createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin) {
      try {
        const url = new URL(origin);
        if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
          res.setHeader('Access-Control-Allow-Origin', origin);
        }
      } catch (e) {
        // Invalid origin, ignore
      }
    }

    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Accept both /inspect and /grab (backwards compat)
    if (req.method !== 'POST' || (req.url !== '/inspect' && req.url !== '/grab')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    const MAX_BODY = 1024 * 512; // 512 KB
    let body = '';
    let overflow = false;

    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
      if (body.length > MAX_BODY) {
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
        const data = JSON.parse(body);

        if (!data.html || !data.componentName) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required fields: html, componentName' }));
          return;
        }

        const context: GrabEntry['context'] = {
          html: data.html,
          componentName: data.componentName,
          filePath: data.filePath ?? null,
          line: data.line ?? null,
          column: data.column ?? null,
          selector: data.selector || '',
          cssClasses: data.cssClasses || [],
          componentStack: (data.componentStack || []).map((entry: Record<string, unknown>) => ({
            name: entry.name || '',
            filePath: entry.filePath ?? null,
            line: entry.line ?? null,
            column: entry.column ?? null,
          })),
          textContent: data.textContent ?? null,
          ariaLabel: data.ariaLabel ?? null,
          role: data.role ?? null,
          elementDescription: data.elementDescription ?? null,
          framework: data.framework ?? null,
          computedStyles: data.computedStyles ?? undefined,
        };

        await addGrab(context, data.snippet || '');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));

        const fw = data.framework ? ` [${data.framework}]` : '';
        console.error(`[point-grab] Grabbed: ${data.componentName}${fw} at ${data.filePath ?? 'unknown'}:${data.line ?? '?'}`);
      } catch (error) {
        console.error('[point-grab] Failed to process grab:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
  });

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `[point-grab] Port ${port} already in use. Webhook disabled — MCP tools still work, but new grabs won't be received.`
      );
      console.error(
        `[point-grab] To use a different port, set POINT_GRAB_PORT env variable.`
      );
    } else {
      console.error(`[point-grab] Webhook server error:`, err);
    }
  });

  httpServer.listen(port, () => {
    console.error(`[point-grab] Webhook listener on http://localhost:${port}/inspect`);
  });
}

// -- MCP server (responds to agent queries via stdio) --

const mcpServer = new Server(
  {
    name: 'point-grab-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'point_grab_search',
      description:
        'Search point-grab history. Query grabbed elements by text, component name, file path, or framework. Returns matching elements with HTML, component info, and stack trace.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description:
              'Search term (searches in HTML, component name, file path, selector, framework)',
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

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const history = await readHistory();

    switch (name) {
      case 'point_grab_search': {
        const { query, componentName, filePath, framework, limit = 10 } = args as {
          query?: string;
          componentName?: string;
          filePath?: string;
          framework?: string;
          limit?: number;
        };

        const results = searchHistory(
          history,
          query,
          componentName,
          filePath,
          framework,
          limit
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { total: results.length, results: results.map(formatEntry) },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'point_grab_recent': {
        const { limit = 5 } = args as { limit?: number };
        const recent = searchHistory(history, undefined, undefined, undefined, undefined, limit);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { total: recent.length, results: recent.map(formatEntry) },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'point_grab_get': {
        const { id } = args as { id: string };
        const entry = history.entries.find((e) => e.id === id);

        if (!entry) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Grab entry with ID "${id}" not found`
          );
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formatEntry(entry), null, 2),
            },
          ],
        };
      }

      case 'point_grab_stats': {
        const uniqueComponents = new Set(
          history.entries.map((e) => e.context.componentName).filter(Boolean)
        );
        const uniqueFiles = new Set(
          history.entries.map((e) => e.context.filePath).filter(Boolean)
        );

        const now = Date.now();
        const last24h = history.entries.filter(
          (e) => now - e.timestamp < 24 * 60 * 60 * 1000
        ).length;
        const last7d = history.entries.filter(
          (e) => now - e.timestamp < 7 * 24 * 60 * 60 * 1000
        ).length;

        const frameworkBreakdown = getFrameworkBreakdown(history);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  totalGrabs: history.entries.length,
                  uniqueComponents: uniqueComponents.size,
                  uniqueFiles: uniqueFiles.size,
                  maxEntries: history.maxEntries,
                  frameworks: frameworkBreakdown,
                  recentActivity: {
                    last24Hours: last24h,
                    last7Days: last7d,
                  },
                  mostRecentGrab: history.entries[0]
                    ? new Date(history.entries[0].timestamp).toISOString()
                    : null,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'point_grab_frameworks': {
        const frameworkBreakdown = getFrameworkBreakdown(history);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  totalGrabs: history.entries.length,
                  frameworks: frameworkBreakdown,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
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

// -- Main --

async function main() {
  if (process.env.POINT_GRAB_HISTORY_PATH) {
    historyPath = process.env.POINT_GRAB_HISTORY_PATH;
  }

  const webhookPort = parseInt(
    process.env.POINT_GRAB_PORT || String(DEFAULT_WEBHOOK_PORT)
  );

  await ensureHistoryFile();

  // Start HTTP listener for incoming grabs from the browser
  startWebhookServer(webhookPort);

  // Start MCP stdio transport for agent queries
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  console.error('[point-grab] MCP server running');
  console.error(`[point-grab] History: ${historyPath}`);
}

main().catch((error) => {
  console.error('[point-grab] Fatal error:', error);
  process.exit(1);
});
