# point-grab

**Platform-agnostic web element inspector for AI coding agents.**

[![npm version](https://img.shields.io/npm/v/%40point-grab%2Fcore)](https://www.npmjs.com/package/@point-grab/core)
[![license](https://img.shields.io/npm/l/%40point-grab%2Fcore)](./LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/%40point-grab%2Fcore)](https://bundlephobia.com/package/@point-grab/core)

Point at any element in a running web app. Get its full context -- cleaned HTML, component name, source file with line number, ancestor chain -- copied to clipboard and sent to your AI coding agent via MCP.

---

## Quick Start

### Script Tag (simplest)

```html
<script src="https://unpkg.com/@point-grab/core/global"></script>
<script>
  const inspector = PointGrab.init();
</script>
```

That's it. Press `Cmd+Shift+C` (Mac) or `Ctrl+Shift+C` (Windows/Linux) to toggle Capture Mode, then click elements to build an AI-ready review prompt.

The IIFE bundle exposes a global `PointGrab`; it does not auto-initialize or create `window.__POINT_GRAB__`.

### npm

```bash
npm install @point-grab/core
```

```typescript
import { init } from '@point-grab/core';

const inspector = init();
// Hold Cmd+C (Mac) / Ctrl+C (Win), hover, click
```

---

## Framework Guides

The core engine works on any page out of the box. Framework adapters add rich metadata: component names, source file paths with line numbers, and component ancestor chains.

### Vanilla JS

```typescript
import { init } from '@point-grab/core';

const inspector = init({
  activationMode: 'toggle',  // toggle instead of hold
  maxContextLines: 30,        // more HTML context
  maxCaptureCount: 5,         // accepted comments per capture session (default: 3)
  themeMode: 'light',
});
```

### Angular

```bash
npm install @point-grab/core @point-grab/angular
```

```typescript
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { initPointGrabAngular } from '@point-grab/angular';
import { appConfig } from './app/app.config';
import { App } from './app/app';

initPointGrabAngular({ activationMode: 'hold', devOnly: false });
bootstrapApplication(App, appConfig).catch((err) => console.error(err));
```

The Angular adapter uses `window.ng.getComponent()` and `window.ng.getOwningComponent()` to resolve component names and walks the DOM to build the component ancestor chain. It strips `_nghost-*`, `_ngcontent-*` attributes and `ng-*` / `_ng*` CSS classes from captured HTML.

Inject the API anywhere via the `POINT_GRAB_API` token:

```typescript
import { inject } from '@angular/core';
import { POINT_GRAB_API } from '@point-grab/angular';

const api = inject(POINT_GRAB_API);
api.setThemeMode('light');
```

### React

```bash
npm install @point-grab/core @point-grab/react
```

```typescript
// App.tsx
import { usePointGrab } from '@point-grab/react';

function App() {
  usePointGrab({ activationMode: 'toggle' });

  return <>{/* your app */}</>;
}
```

The React adapter walks the fiber tree via `__reactFiber$` and reads `_debugSource` for source file paths. It strips `data-reactroot` and `data-reactid` attributes from captured HTML.

`usePointGrab` returns the `PointGrabAPI` instance and auto-disposes on unmount.

### Vue

```bash
npm install @point-grab/core @point-grab/vue
```

```typescript
// main.ts
import { createApp } from 'vue';
import { PointGrabPlugin } from '@point-grab/vue';
import App from './App.vue';

const app = createApp(App);
app.use(PointGrabPlugin, { activationMode: 'toggle' });
app.mount('#app');
```

The Vue adapter finds component instances via `__vueParentComponent` / `__vnode`, walks the `parent` chain for ancestors, and reads `type.__file` for source locations. It strips `data-v-*` scoped style attributes from captured HTML.

The API is available via Vue's inject:

```typescript
const pointGrab = inject('$point-grab');
```

### Svelte

```bash
npm install @point-grab/core @point-grab/svelte
```

```svelte
<!-- +layout.svelte or App.svelte -->
<script lang="ts">
  import { pointGrab } from '@point-grab/svelte';
</script>

<div use:pointGrab>
  <slot />
</div>
```

Or pass options:

```svelte
<div use:pointGrab={{ activationMode: 'toggle' }}>
  <slot />
</div>
```

The Svelte adapter reads `__svelte_meta` (Svelte 5) and `__svelte_component` (Svelte 4) for component names and `__svelte_meta.loc` for source locations. It strips `s-*` and `svelte-*` CSS classes and `svelte-*` attributes.

### Web Components

```bash
npm install @point-grab/core @point-grab/web-components
```

```typescript
import { initPointGrabWebComponents } from '@point-grab/web-components';

const inspector = initPointGrabWebComponents({
  activationMode: 'toggle',
});
```

The Web Components adapter detects custom elements (tags containing `-`), traverses Shadow DOM boundaries via `shadowRoot` and `getRootNode()`, and resolves component names from the custom element class name or tag. It includes utilities for deep `elementFromPoint` that pierces shadow roots and shadow tree serialization.

---

## What Gets Captured

When you click an element, point-grab copies a structured context snippet:

```
<div class="profile-card">
  <img class="avatar" src="/avatars/123.jpg" alt="User avatar" />
  <h2 class="name">Jane Doe</h2>
  <span class="role">Engineer</span>
</div>
in UserProfileCard at src/components/UserProfileCard.tsx:42
in Dashboard at src/pages/Dashboard.tsx:18
in App at src/App.tsx:7
```

The HTML is cleaned: framework-internal attributes (`_ngcontent-*`, `data-reactid`, `data-v-*`, etc.) are stripped using configurable `HtmlCleaner` regex pairs, and framework CSS classes are filtered using configurable `ClassFilter` functions. What remains is the semantic structure an AI agent needs to locate and modify the element.

---

## MCP Integration

The `@point-grab/mcp-server` package exposes point-grab's capture history as an MCP tool server. AI agents like Claude Code, Cursor, and Windsurf can query it directly.

By default, the core engine auto-registers an MCP webhook plugin (`mcpWebhook: true`) that POSTs captures to `http://localhost:3456/inspect`.

The built-in webhook only sends `html`, `componentName`, `filePath`, `line`, `column`, `selector`, `cssClasses`, `snippet`, and `componentStack`. Because the MCP server requires both `html` and `componentName`, core-only / vanilla captures still copy to your clipboard but are not persisted to MCP history unless a component name is available.

### Setup

```bash
npm install -g @point-grab/mcp-server
```

#### Claude Code

```bash
claude mcp add point-grab -- npx @point-grab/mcp-server
```

#### Cursor / Windsurf

Add to your MCP config (`.cursor/mcp.json` or equivalent):

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

### Disable the Auto-Webhook

If you don't want the automatic MCP webhook plugin:

```typescript
const inspector = init({ mcpWebhook: false });
```

If you need a different endpoint or want to include extra fields such as `framework`, register your own plugin instead of using the built-in webhook.

### Available MCP Tools

| Tool | Description |
|---|---|
| `point_grab_search` | Search history by text, component name, file path, or framework when your sender includes it |
| `point_grab_recent` | Get the N most recent captures |
| `point_grab_get` | Get a specific capture by ID |
| `point_grab_stats` | Summary stats: total grabs, unique components, unique files, and framework breakdown when available |
| `point_grab_frameworks` | Grab counts grouped by detected framework values present in stored history |

See [docs/mcp.md](./docs/mcp.md) for full tool schemas and example responses.

---

## Configuration

### PointGrabOptions

| Option | Type | Default | Description |
|---|---|---|---|
| `activationKey` | `string` | `'Meta+C'` (Mac) / `'Ctrl+C'` (Win) | Keyboard shortcut to activate |
| `activationMode` | `'hold' \| 'toggle'` | `'hold'` | Hold key to inspect, or toggle on/off |
| `keyHoldDuration` | `number` | `0` | Milliseconds to hold before activating (hold mode only) |
| `maxContextLines` | `number` | `20` | Max lines of HTML in the copied snippet |
| `enabled` | `boolean` | `true` | Master on/off switch |
| `enableInInputs` | `boolean` | `false` | Allow activation while focused in input/textarea |
| `devOnly` | `boolean` | `true` | Only activate in dev mode (checks `ngDevMode`, `NODE_ENV`, `__POINT_GRAB_DEV__`) |
| `showToolbar` | `boolean` | `true` | Show the floating mini toolbar |
| `themeMode` | `ThemeMode` | `'dark'` | `'light'`, `'dark'`, or `'system'` |
| `mcpWebhook` | `boolean` | `true` | Auto-register MCP webhook plugin (POSTs to localhost:3456) |
| `classFilters` | `ClassFilter[]` | `[]` | Functions that return `true` to keep a CSS class, `false` to strip it |
| `htmlCleaners` | `HtmlCleaner[]` | `[]` | Regex/replacer pairs for cleaning framework attributes from HTML |

### Key Types

```typescript
type ThemeMode = 'light' | 'dark' | 'system';

/** Return true to keep the class, false to strip it from captured HTML. */
type ClassFilter = (className: string) => boolean;

/** A regex/replacer pair applied to outerHTML before copying. */
type HtmlCleaner = { pattern: RegExp; replacement: string };
```

---

## Plugin System

Plugins extend point-grab's behavior at well-defined hook points.

```typescript
import { init, type Plugin } from '@point-grab/core';

const logPlugin: Plugin = {
  name: 'log',
  hooks: {
    onCopySuccess(snippet, context) {
      console.log('Captured:', context.componentName, context.filePath);
    },
  },
};

const inspector = init();
inspector.registerPlugin(logPlugin);
```

Or unregister dynamically:

```typescript
inspector.unregisterPlugin('log');
```

Plugins can also provide a `setup` function that receives the `PointGrabAPI` and optionally returns a cleanup function:

```typescript
const myPlugin: Plugin = {
  name: 'my-plugin',
  setup(api) {
    const listener = () => console.log('active:', api.isActive());
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  },
};
```

See [docs/plugins.md](./docs/plugins.md) for the full hook reference and plugin development guide.

---

## Keyboard Shortcuts

Default activation: hold `Cmd+C` (Mac) or `Ctrl+C` (Windows/Linux).

In hold mode, the inspector activates while the key combination is held down and deactivates on release. In toggle mode, the shortcut toggles the inspector on and off.

While the inspector is active:

| Key | Action |
|---|---|
| `F` | Freeze/unfreeze selection mode (keep inspector active after releasing keys) |

Customize the activation shortcut:

```typescript
const inspector = init({
  activationKey: 'Ctrl+Shift+X',
  activationMode: 'toggle',
});
```

Key combo format: modifier names (`Meta`, `Cmd`, `Command`, `Ctrl`, `Control`, `Shift`, `Alt`, `Option`) joined with `+` followed by the key name.

---

## Theming

PointGrab defaults to dark theme. Cycle through themes via the toolbar button, or set programmatically:

```typescript
inspector.setThemeMode('light');  // 'light' | 'dark' | 'system'
```

Plugins can override theme colors via the `theme` property:

```typescript
const myPlugin: Plugin = {
  name: 'my-theme',
  theme: {
    overlayBorderColor: '#ff6b6b',
    overlayBgColor: 'rgba(255, 107, 107, 0.1)',
    labelBgColor: '#1e1e2e',
    labelTextColor: '#cdd6f4',
    toolbarBgColor: '#1e1e2e',
    toolbarTextColor: '#cdd6f4',
    toolbarAccentColor: '#89b4fa',
  },
};
```

### Theme Properties

| Property | Description |
|---|---|
| `overlayBorderColor` | Border color of the hover overlay |
| `overlayBgColor` | Background color of the hover overlay |
| `labelBgColor` | Background of the element label tooltip |
| `labelTextColor` | Text color of the element label tooltip |
| `toastBgColor` | Background of the copy confirmation toast |
| `toastTextColor` | Text color of the copy confirmation toast |
| `toolbarBgColor` | Toolbar background |
| `toolbarTextColor` | Toolbar text/icon color |
| `toolbarAccentColor` | Toolbar accent/highlight color |
| `popoverBgColor` | History/actions popover background |
| `popoverTextColor` | Popover text color |
| `popoverBorderColor` | Popover border color |

---

## API Reference

### `init(options?: Partial<PointGrabOptions>): PointGrabAPI`

Create and return an inspector instance. If `devOnly` is `true` (default) and the app is in production mode, returns a no-op API.

### PointGrabAPI

```typescript
interface PointGrabAPI {
  /** Activate the inspector -- start listening for hover/click */
  activate(): void;

  /** Deactivate the inspector -- stop listening, remove overlays */
  deactivate(): void;

  /** Toggle active state */
  toggle(): void;

  /** Check if the inspector is currently active */
  isActive(): boolean;

  /** Merge new options into current configuration */
  setOptions(opts: Partial<PointGrabOptions>): void;

  /** Register a plugin */
  registerPlugin(plugin: Plugin): void;

  /** Unregister a plugin by name */
  unregisterPlugin(name: string): void;

  /** Set the component resolver (used by framework adapters) */
  setComponentResolver(resolver: ComponentResolver): void;

  /** Set the source location resolver (used by framework adapters) */
  setSourceResolver(resolver: SourceResolver): void;

  /** Override how the picker resolves the hovered DOM element */
  setElementFromPoint(fn: (x: number, y: number) => Element | null): void;

  /** Show the floating toolbar */
  showToolbar(): void;

  /** Hide the floating toolbar */
  hideToolbar(): void;

  /** Set light, dark, or system theme mode */
  setThemeMode(mode: ThemeMode): void;

  /** Get all captures in history */
  getHistory(): HistoryEntry[];

  /** Clear capture history */
  clearHistory(): void;

  /** Tear down the inspector -- remove all DOM, listeners, plugins */
  dispose(): void;
}
```

### Resolver Types

Adapters register these function types to provide framework-specific metadata:

```typescript
type ComponentResolver = (element: Element) => {
  name: string | null;
  hostElement: Element | null;
  stack?: Array<{ name: string; hostElement: Element | null }>;
} | null;

type SourceResolver = (element: Element) => {
  filePath: string | null;
  line: number | null;
  column: number | null;
} | null;
```

### Capture Types

```typescript
interface ElementContext {
  element: Element;
  html: string;
  componentName: string | null;
  filePath: string | null;
  line: number | null;
  column: number | null;
  componentStack: ComponentStackEntry[];
  selector: string;
  cssClasses: string[];
  textContent: string | null;
  ariaLabel: string | null;
  role: string | null;
  elementDescription: string | null;
}

interface ComponentStackEntry {
  name: string;
  filePath: string | null;
  line: number | null;
  column: number | null;
}

interface HistoryEntry {
  id: string;
  context: HistoryContext;   // serializable subset of ElementContext (no Element ref)
  snippet: string;
  timestamp: number;
}
```

### Plugin Types

```typescript
interface Plugin {
  name: string;
  hooks?: PluginHooks;
  theme?: Partial<Theme>;
  options?: Partial<PointGrabOptions>;
  setup?: (api: PointGrabAPI) => PluginCleanup | void;
}

type PluginCleanup = () => void;

interface PluginHooks {
  onActivate?(): void;
  onDeactivate?(): void;
  onElementHover?(element: Element): void;
  onElementSelect?(context: ElementContext): void;
  onBeforeCopy?(context: ElementContext): void;
  onCopySuccess?(text: string, context: ElementContext, prompt?: string): void;
  onCopyError?(error: Error): void;
  transformCopyContent?(text: string, context: ElementContext): string;
}
```

---

## Packages

| Package | Description |
|---|---|
| [`@point-grab/core`](./packages/core) | Core engine -- picker, overlays, toolbar, keyboard, clipboard, plugins, reactive store |
| [`@point-grab/angular`](./packages/angular) | Angular adapter -- `window.ng` debug API and `initPointGrabAngular()` bootstrap |
| [`@point-grab/react`](./packages/react) | React adapter -- fiber tree, `_debugSource`, `usePointGrab()` hook |
| [`@point-grab/vue`](./packages/vue) | Vue adapter -- component tree, `__file`, `PointGrabPlugin` for `app.use()` |
| [`@point-grab/svelte`](./packages/svelte) | Svelte adapter -- `__svelte_meta`, `use:pointGrab` action |
| [`@point-grab/web-components`](./packages/web-components) | Web Components adapter -- Shadow DOM traversal, custom element detection |
| [`@point-grab/mcp-server`](./packages/mcp-server) | MCP server -- stdio transport for AI agents + HTTP webhook for browser |

---

## Contributing

```bash
git clone https://github.com/Nacho-Labs-LLC/point-grab.git
cd point-grab
pnpm install
pnpm build
pnpm test
```

The repo uses [pnpm workspaces](https://pnpm.io/workspaces) + [Turborepo](https://turbo.build/) for orchestration and [tsup](https://tsup.egoist.dev/) for builds. Each package lives in `packages/` with its own `tsup.config.ts`.

To work on a specific package:

```bash
pnpm --filter @point-grab/react dev
```

Run the full suite:

```bash
pnpm build     # build all packages
pnpm test      # run all tests
pnpm lint      # typecheck all packages
```

---

## License

[MIT](./LICENSE)
