# @point-grab/core

Platform-agnostic web element inspector for AI coding agents.

Point at any element in a running app, capture cleaned HTML plus source context, copy it to the clipboard, and optionally forward it to an MCP agent workflow.

## Install

```bash
npm install @point-grab/core
```

## Quick start

```ts
import { init } from '@point-grab/core';

const pointGrab = init();
```

Default flow:
- hold `Cmd+C` on macOS or `Ctrl+C` on Windows/Linux
- hover an element
- click to capture it

## Global script usage

```html
<script src="https://unpkg.com/@point-grab/core/global"></script>
<script>
  PointGrab.init();
</script>
```

## Basic configuration

```ts
import { init } from '@point-grab/core';

const pointGrab = init({
  activationMode: 'toggle',
  themeMode: 'system',
  maxContextLines: 40,
  mcpWebhook: true,
});
```

## What gets captured

A capture can include:
- cleaned element HTML
- selector and CSS classes
- component name
- source file path and line number
- ancestor component stack
- framework metadata when an adapter provides it

## Related packages

Framework adapters build on top of `@point-grab/core`:
- `@point-grab/react`
- `@point-grab/angular`
- `@point-grab/vue`
- `@point-grab/svelte`
- `@point-grab/web-components`

## MCP integration

By default, core can POST captures to a local MCP webhook on `http://localhost:3456/inspect`.
Use `@point-grab/mcp-server` to receive and expose those captures to coding agents.

## Docs

- Site: https://point-grab.com
- MCP docs: https://point-grab.com/docs/mcp
- Repo: https://github.com/Nacho-Labs-LLC/point-grab
