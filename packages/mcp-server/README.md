# @point-grab/mcp-server

MCP stdio + webhook server for point-grab captures.

This package receives captures from `@point-grab/core`, stores capture history locally, and exposes that history to AI coding agents over the Model Context Protocol.

## Install

```bash
npm install @point-grab/mcp-server
```

Or run it directly with npx:

```bash
npx @point-grab/mcp-server
```

## What it does

- starts an MCP stdio server
- starts a local webhook listener on `http://localhost:3456/inspect`
- stores capture history in `~/.point-grab/history.json`
- exposes recent captures, search, and capture resources to MCP clients

## Claude Code

```bash
claude mcp add point-grab -- npx @point-grab/mcp-server
```

## Cursor / MCP JSON config

```json
{
  "mcpServers": {
    "point-grab": {
      "command": "npx",
      "args": ["@point-grab/mcp-server"]
    }
  }
}
```

## Environment

Optional environment variables:

- `POINT_GRAB_PORT` — override webhook port (default `3456`)
- `POINT_GRAB_HISTORY_PATH` — override history file path

## Browser-side pairing

`@point-grab/core` sends captures to this server automatically when `mcpWebhook` is enabled.

```ts
import { init } from '@point-grab/core';

init({ mcpWebhook: true });
```

## Docs

- Site: https://point-grab.com
- MCP docs: https://point-grab.com/docs/mcp
- Repo: https://github.com/Nacho-Labs-LLC/point-grab
