# MCP Server

The `@pointgrab/mcp-server` package exposes pointgrab's capture history to AI coding agents via the [Model Context Protocol](https://modelcontextprotocol.io/).

## What is MCP?

MCP (Model Context Protocol) is a standard for connecting AI agents to external tools and data sources. An MCP server exposes "tools" that agents can call. The `@pointgrab/mcp-server` exposes tools that let an agent query element captures from your running web app.

The flow: you inspect an element in the browser, pointgrab's webhook plugin POSTs the capture to the MCP server, and your AI agent queries the MCP server to get the context it needs to make changes.

## Setup

### Install

```bash
npm install -g @pointgrab/mcp-server
```

Or use `npx` without installing:

```bash
npx @pointgrab/mcp-server
```

### Claude Code

```bash
claude mcp add pointgrab -- npx @pointgrab/mcp-server
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "pointgrab": {
      "command": "npx",
      "args": ["@pointgrab/mcp-server"]
    }
  }
}
```

### Windsurf

Add to your Windsurf MCP configuration:

```json
{
  "mcpServers": {
    "pointgrab": {
      "command": "npx",
      "args": ["@pointgrab/mcp-server"]
    }
  }
}
```

### Browser Side

By default, `pointgrab` auto-registers an MCP webhook plugin that POSTs every capture to `http://localhost:3456/inspect`. No additional browser configuration is needed.

If you disabled the auto-webhook (`mcpWebhook: false`), you can re-enable it or configure a custom URL:

```typescript
import { init } from 'pointgrab';

// Default behavior -- webhook is auto-registered
const inspector = init();

// Or explicitly disable it
const inspector = init({ mcpWebhook: false });
```

## Available Tools

### `pointgrab_search`

Search capture history by text, component name, file path, or framework.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | no | Search term (matches against HTML, component name, file path, selector, framework) |
| `componentName` | `string` | no | Filter by component name (partial match) |
| `filePath` | `string` | no | Filter by file path (partial match) |
| `framework` | `string` | no | Filter by framework (exact match: `"angular"`, `"react"`, `"vue"`, `"svelte"`, `"web-components"`, `"vanilla"`) |
| `limit` | `number` | no | Max results to return (default: 10) |

**Example request:**

```json
{
  "tool": "pointgrab_search",
  "arguments": {
    "query": "UserCard",
    "limit": 5
  }
}
```

**Example response:**

```json
{
  "total": 1,
  "results": [
    {
      "id": "1714200000000-abc123",
      "timestamp": "2025-04-27T12:00:00.000Z",
      "snippet": "<div class=\"user-card\">\n  <h3>Jane Doe</h3>\n</div>\nin UserCard at src/components/UserCard.tsx:18",
      "context": {
        "componentName": "UserCard",
        "filePath": "src/components/UserCard.tsx",
        "line": 18,
        "column": null,
        "selector": "div.user-card",
        "cssClasses": ["user-card"],
        "html": "<div class=\"user-card\">\n  <h3>Jane Doe</h3>\n</div>",
        "componentStack": [
          { "name": "UserCard", "filePath": "src/components/UserCard.tsx", "line": 18, "column": null },
          { "name": "Dashboard", "filePath": "src/pages/Dashboard.tsx", "line": 42, "column": null },
          { "name": "App", "filePath": "src/App.tsx", "line": 7, "column": null }
        ],
        "framework": "react",
        "computedStyles": null
      }
    }
  ]
}
```

### `pointgrab_recent`

Get the N most recent captures.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `limit` | `number` | no | Number of recent captures to return (default: 5) |

**Example request:**

```json
{
  "tool": "pointgrab_recent",
  "arguments": {
    "limit": 3
  }
}
```

Returns the same response shape as `pointgrab_search`.

### `pointgrab_get`

Get a specific capture by ID.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | **yes** | The capture entry ID (e.g., `"1714200000000-abc123"`) |

Returns a single entry object (same shape as entries in `pointgrab_search` results). Throws an error if the ID is not found.

### `pointgrab_stats`

Get summary statistics about the capture history.

**Parameters:** None.

**Example response:**

```json
{
  "totalGrabs": 47,
  "uniqueComponents": 12,
  "uniqueFiles": 8,
  "maxEntries": 50,
  "frameworks": {
    "react": 38,
    "angular": 9
  },
  "recentActivity": {
    "last24Hours": 15,
    "last7Days": 47
  },
  "mostRecentGrab": "2025-04-27T12:00:00.000Z"
}
```

### `pointgrab_frameworks`

Get capture counts grouped by detected framework.

**Parameters:** None.

**Example response:**

```json
{
  "totalGrabs": 47,
  "frameworks": {
    "react": 38,
    "angular": 9
  }
}
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `POINTGRAB_PORT` | `3456` | HTTP port for the webhook listener |
| `POINTGRAB_HISTORY_PATH` | `~/.pointgrab/history.json` | File path for persistent history |

### Example with Custom Configuration

```bash
POINTGRAB_PORT=4000 \
POINTGRAB_HISTORY_PATH=/tmp/pointgrab-history.json \
npx @pointgrab/mcp-server
```

Or in your MCP config:

```json
{
  "mcpServers": {
    "pointgrab": {
      "command": "npx",
      "args": ["@pointgrab/mcp-server"],
      "env": {
        "POINTGRAB_PORT": "4000",
        "POINTGRAB_HISTORY_PATH": "/Users/you/.pointgrab/history.json"
      }
    }
  }
}
```

## How the Pipeline Works

```
 Browser                     MCP Server                    AI Agent
 -------                     ----------                    --------

 1. User holds Cmd+C,
    hovers, clicks element
         |
 2. pointgrab copies snippet
    to clipboard
         |
 3. MCP webhook plugin
    fires onCopySuccess:
    POST /inspect ----------> 4. Validate payload
    (HTTP, port 3456)            (requires html + componentName)
                                 |
                             5. Serialize write to
                                ~/.pointgrab/history.json
                                 |
                             6. Return 200 OK
                                                    7. Agent calls
                                                       pointgrab_recent
                                                           |
                                              8. MCP server <---- stdio
                                                 reads history
                                                 from disk
                                                       |
                                              9. Returns captures
                                                 to agent via MCP
                                                       |
                                             10. Agent uses context
                                                 to find and edit
                                                 the right code
```

### Webhook Endpoint

The MCP server listens on two paths (for backward compatibility):

```
POST http://{host}:{port}/inspect
POST http://{host}:{port}/grab
Content-Type: application/json

{
  "html": "<div>...</div>",           // required
  "componentName": "UserCard",        // required
  "filePath": "src/UserCard.tsx",     // optional
  "line": 18,                         // optional
  "column": null,                     // optional
  "componentStack": [...],            // optional
  "selector": "div.user-card",       // optional
  "cssClasses": ["user-card"],       // optional
  "framework": "react",              // optional
  "snippet": "...",                   // optional
  "computedStyles": {}               // optional
}
```

**Responses:**

| Status | Meaning |
|---|---|
| `200 OK` | Capture stored successfully |
| `400 Bad Request` | Missing required fields (`html`, `componentName`) |
| `413 Payload Too Large` | Body exceeds 512 KB |
| `500 Internal Server Error` | Server error |

### Persistent History

History is stored as a JSON file at `~/.pointgrab/history.json` (or `POINTGRAB_HISTORY_PATH`). Structure:

```typescript
interface GrabHistory {
  entries: GrabEntry[];
  maxEntries: number;  // default: 50
}
```

The server creates the directory and file on first startup. Writes are serialized to prevent concurrent data loss (each write reads fresh from disk, prepends the new entry, truncates to `maxEntries`, and writes atomically).

### CORS

The webhook endpoint includes CORS headers (`Access-Control-Allow-Origin: *`) so the browser-side webhook plugin can POST from any origin. Preflight `OPTIONS` requests return `204`.

### Port Conflicts

If the configured port is already in use, the MCP server logs a warning but continues running. MCP tools still work (they read from the history file on disk), but new captures from the browser won't be received until the port conflict is resolved.

## Typical Workflow

1. Start your web app in development mode
2. The MCP server starts automatically with your AI agent (Claude Code, Cursor, etc.)
3. Hold `Cmd+C` (Mac) / `Ctrl+C` (Win) in your browser
4. Hover over the element you want to modify
5. Click to capture -- it's copied to clipboard and sent to the MCP server
6. Switch to your AI agent and ask it to modify the captured element
7. The agent calls `pointgrab_recent` to get the capture context
8. The agent now knows the component name, source file, line number, HTML structure, and ancestor chain

No copy-pasting file paths. No describing the element in words. Point, click, and talk to your agent.
