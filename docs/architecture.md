# Architecture

Technical architecture of the point-grab platform.

## System Overview

```
Browser                                          AI Agent
+------------------------------------------+    +-----------------+
|                                          |    |                 |
|  +------------+    +-----------------+   |    |  Claude Code /  |
|  | Framework  |    |   Core Engine   |   |    |  Cursor / etc.  |
|  | Adapter    |--->|                 |   |    |                 |
|  | (optional) |    |  Picker         |   |    +--------^--------+
|  +------------+    |  Overlays       |   |             |
|                    |  Toolbar        |   |        MCP Protocol
|  +------------+    |  Keyboard       |   |        (stdio)
|  | Plugin     |--->|  Clipboard      |   |             |
|  | (optional) |    |  Store          |   |    +--------+--------+
|  +------------+    +--------+--------+   |    |                 |
|                             |            |    | @point-grab/       |
|                    +--------v--------+   |    | mcp-server      |
|                    |   Output        |   |    |                 |
|                    |                 |   |    | - HTTP webhook  |
|                    | - clipboard     |   |    |   :3456/inspect |
|                    | - toast         |   |    | - History file  |
|                    | - webhook ------+---+--->|   ~/.point-grab/   |
|                    |   (MCP plugin)  |   |    | - MCP tools     |
|                    +-----------------+   |    |                 |
|                                          |    +-----------------+
+------------------------------------------+
```

## Core Engine

The core engine (`@point-grab/core` package, published from `packages/core`) is framework-agnostic pure DOM code. It has no dependencies on any UI framework. Everything operates on raw `Element` references and standard browser APIs.

### Module Breakdown

```
packages/core/src/
  index.ts                      # Public exports: init, createNoopApi, types
  index.global.ts               # IIFE entry: exports the PointGrab global
  grab.ts                       # createPointGrabInstance(), PointGrabAPI factory
  types.ts                      # All public type definitions
  store.ts                      # Proxy-based reactive state
  constants.ts                  # Z-index values, layout offsets
  utils.ts                      # HTML escaping, class filtering, attribute cleaning

  picker/
    element-picker.ts           # Mouse tracking, element selection

  overlay/
    overlay-renderer.ts         # Hover overlay (bounding box highlight + label)
    crosshair.ts                # Crosshair cursor during selection
    freeze-overlay.ts           # Screen freeze overlay (keeps inspector active)
    toast.ts                    # Copy confirmation toast
    select-feedback.ts          # Visual feedback on element selection

  keyboard/
    keyboard-handler.ts         # Shortcut registration, hold/toggle modes

  clipboard/
    copy.ts                     # buildElementContext(), copyElement()
    generate-snippet.ts         # Format context into copyable text snippet

  toolbar/
    toolbar-renderer.ts         # Floating mini toolbar UI
    theme-manager.ts            # Theme application and CSS variable injection
    history-popover.ts          # History list popover
    actions-menu.ts             # Actions dropdown (copy element, styles, HTML, comment)
    comment-popover.ts          # Comment input for annotated copies
    copy-actions.ts             # Individual copy operations (snippet, HTML, styles, comment)

  plugins/
    plugin-registry.ts          # Plugin registration, hook dispatch
    mcp-webhook-plugin.ts       # Built-in webhook plugin (POST to MCP server)
```

## How the Picker Works

The picker is the heart of point-grab. Here is the full cycle from activation to capture:

```
User holds Cmd+C (or configured key)
  |
  v
keyboard-handler detects keydown matching activationKey
  -> In hold mode: activate immediately (or after keyHoldDuration)
  -> In toggle mode: toggle on keyup
  |
  v
doActivate()
  -> picker.activate()
  -> crosshair.activate()
  -> Register mousemove + click listeners on document (capture phase)
  -> pluginRegistry.callHook('onActivate')
  |
  v
mousemove fires
  |
  v
elementFromPoint(e.clientX, e.clientY)
  (freeze overlay temporarily set to pointer-events:none)
  |
  v
Filter: skip overlay elements, crosshair, toolbar/popover elements
  |
  v
componentResolver(element)  -- if adapter registered
  |  Returns { name, hostElement, stack }
  v
sourceResolver(element)  -- if adapter registered
  |  Returns { filePath, line, column }
  v
Render overlay (positioned via getBoundingClientRect)
  |  Shows: tag name, component name, source path, CSS classes
  |
  v  pluginRegistry.callHook('onElementHover', element)
  v
click fires (capture phase, preventDefault + stopPropagation)
  |
  v
Check for pending toolbar action (copy-element, copy-styles, copy-html, comment)
  |
  v  [default flow, no pending action]
  v
copyElement():
  1. buildElementContext():
     - componentResolver(element) -> name, hostElement, stack
     - sourceResolver(element) -> filePath, line, column
     - For each stack entry: sourceResolver(entry.hostElement) -> stack source info
     - filterFrameworkClasses(element.classList, classFilters) -> cssClasses
     - Build selector string (tag#id.class1.class2)
     - Store raw element.outerHTML
  2. pluginRegistry.callHook('onElementSelect', context)
  3. pluginRegistry.callHook('onBeforeCopy', context)
  4. generateSnippet(context, maxContextLines, htmlCleaners):
     - cleanFrameworkAttrs(html, htmlCleaners)  // strip _ngcontent-*, data-v-*, etc.
     - truncateHtml(cleaned, maxContextLines)
     - Append location lines: "in ComponentName at file:line:column"
     - For each componentStack entry: "in Name at file:line:column"
  5. pluginRegistry.callTransformHook(snippet, context)  // plugins can modify
  6. navigator.clipboard.writeText(snippet)
  7. showToast('Copied to clipboard', detail)
  8. pluginRegistry.callHook('onCopySuccess', snippet, context)
  9. Add to history
  |
  v
User releases key (hold mode) -> doDeactivate()
  -> picker.deactivate()
  -> Remove listeners, hide overlay
  -> pluginRegistry.callHook('onDeactivate')
```

### Freeze Mode

Pressing `F` during selection mode freezes the inspector, keeping it active even after releasing the activation key. This is useful for inspecting elements that require precise positioning. Press `F` again to unfreeze.

## Adapter Pattern

Framework adapters implement two function types and register them with the core engine:

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

These are plain functions, not class instances. The core engine calls them on hover and capture.

### How Each Adapter Works

**Angular** (`@point-grab/angular`):
- Uses `window.ng.getComponent(element)` to find the component instance on the element
- Falls back to `window.ng.getOwningComponent(element)` for elements inside component templates
- Walks `element.parentElement` collecting every component host for the stack
- Component names come from `component.constructor.name` (with `_` prefix stripped via `cleanComponentName`)
- Source locations use a global `__POINT_GRAB_SOURCE_MAP__` (component name -> `{ file, line }`)
- Class filter: strips classes starting with `ng-` or `_ng`
- HTML cleaners: strips `_nghost-*` and `_ngcontent-*` attributes

**React** (`@point-grab/react`):
- Finds the fiber node via `element[__reactFiber$...]` or `element[__reactInternalInstance$...]`
- Walks fiber tree via `.return` collecting function/class component fibers (tag 0 or 1)
- Component names from `fiber.type.displayName || fiber.type.name`
- Source locations from `fiber._debugSource.{ fileName, lineNumber, columnNumber }`
- Falls back to `_debugOwner` chain if direct fiber has no source
- Class filter: strips classes starting with `r-`
- HTML cleaners: strips `data-reactroot` and `data-reactid` attributes

**Vue** (`@point-grab/vue`):
- Finds component instance via `element.__vueParentComponent` or `element.__vnode.component`
- Walks the Vue `parent` chain for ancestor resolution
- Component names from `type.__name || type.name`, or derived from `type.__file` path
- Source locations from `type.__file` (line info not available at Vue runtime)
- Class filter: pass-through (Vue doesn't inject framework classes)
- HTML cleaners: strips `data-v-*` scoped style attributes

**Svelte** (`@point-grab/svelte`):
- Svelte 5: reads `element.__svelte_meta.{ loc, name }`
- Svelte 4: reads `element.__svelte_component.constructor.name`
- Source locations from `__svelte_meta.loc.{ file, line, column }`
- Class filter: strips `s-*` and `svelte-*` prefixed classes
- HTML cleaners: strips `svelte-*` attributes

**Web Components** (`@point-grab/web-components`):
- Detects custom elements: `element.tagName.includes('-')` and `customElements.get(tagName) !== undefined`
- Walks Shadow DOM boundaries via `element.getRootNode()` -> `ShadowRoot.host`
- Component name from constructor class name, falling back to tag name
- Source locations: checks `Constructor.__source` (build-time injected) then global `__POINT_GRAB_WC_SOURCE_MAP__`
- Includes `deepElementFromPoint()` that pierces shadow roots
- Includes `serializeShadowTree()` for rendering shadow DOM content
- Class filter and HTML cleaners: pass-through (no framework-specific artifacts)

### Adapter Registration Pattern

Each adapter follows the same idempotent initialization pattern:

```typescript
// In every adapter's init.ts:
let instance: PointGrabAPI | null = null;

export function initPointGrabFoo(options?: Partial<PointGrabOptions>): PointGrabAPI {
  if (instance) return instance;

  // Production guard
  if (options?.devOnly !== false && /* framework-specific prod check */) {
    instance = createNoopApi();
    return instance;
  }

  instance = init(options);
  instance.setComponentResolver((el) => resolveComponent(el));
  instance.setSourceResolver((el) => resolveSource(el));
  instance.setOptions({
    classFilters: [fooClassFilter],
    htmlCleaners: fooHtmlCleaners,
  });

  return instance;
}
```

The core engine calls `componentResolver(element)` on every hover. If no adapter is registered, the core still works -- it just reports raw HTML with no component metadata.

## State Management

The core engine uses a `Proxy`-based reactive store:

```typescript
interface PointGrabState {
  active: boolean;
  frozen: boolean;
  hoveredElement: Element | null;
  options: PointGrabOptions;
  toolbar: ToolbarState;
}

interface ToolbarState {
  visible: boolean;
  themeMode: ThemeMode;
  history: HistoryEntry[];
  pendingAction: PendingAction | null;
}
```

The `Proxy` intercepts property writes on the top-level state object and notifies subscribers:

```typescript
const state = new Proxy(raw, {
  set(target, prop, value) {
    if (target[key] === value) return true;  // skip no-ops
    Reflect.set(target, key, value);
    listeners.forEach((fn) => fn(state, key));
    return true;
  },
});
```

Subscribers receive the full state and the key that changed:

```typescript
store.subscribe((state, key) => {
  if (key === 'options') { /* react to option changes */ }
  if (key === 'toolbar') { /* update toolbar UI */ }
});
```

No external state library. The `Proxy` approach keeps the implementation under 50 lines.

## Plugin Lifecycle

```typescript
interface Plugin {
  name: string;
  hooks?: PluginHooks;
  theme?: Partial<Theme>;
  options?: Partial<PointGrabOptions>;
  setup?: (api: PointGrabAPI) => PluginCleanup | void;
}
```

### Registration

When `registerPlugin(plugin)` is called:

1. If `plugin.options` is set, merge into `store.state.options`
2. If `plugin.theme` is set, apply theme overrides via `themeManager.applyOverrides()`
3. Call `pluginRegistry.register(plugin, api)`:
   - If `plugin.setup` exists, call it with the API. Store the returned cleanup function.
   - Store the plugin for hook dispatch.

### Hook Execution Order

```
activate()
  -> hooks.onActivate()

mousemove
  -> hooks.onElementHover(element)

click (capture flow)
  -> hooks.onElementSelect(context)
  -> hooks.onBeforeCopy(context)
  -> hooks.transformCopyContent(snippet, context)  // can modify the snippet
  -> hooks.onCopySuccess(snippet, context)
     or
  -> hooks.onCopyError(error)

deactivate()
  -> hooks.onDeactivate()

dispose()
  -> cleanup functions from setup()
```

### Built-in MCP Webhook Plugin

When `mcpWebhook: true` (default), the core auto-registers `createMcpWebhookPlugin()`. This plugin listens for `onCopySuccess` and POSTs the capture context to `http://localhost:3456/inspect`, where the MCP server stores it.

## Build Pipeline

The monorepo uses [Turborepo](https://turbo.build/) for task orchestration, [pnpm workspaces](https://pnpm.io/workspaces) for dependency management, and [tsup](https://tsup.egoist.dev/) for bundling.

### Core Package Build Outputs

```typescript
// packages/core/tsup.config.ts
defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
  },
  {
    entry: { 'index.global': 'src/index.global.ts' },
    format: ['iife'],
    globalName: 'PointGrab',
    minify: true,
  },
]);
```

| Format | File | Use Case |
|---|---|---|
| ESM | `dist/index.mjs` | Bundler imports |
| CJS | `dist/index.cjs` | Node.js / legacy |
| IIFE | `dist/index.global.js` | CDN script tag |
| Types | `dist/index.d.ts` | TypeScript declarations |

The IIFE build (`index.global.ts`) exposes the `PointGrab` global. Consumers still call `PointGrab.init()` themselves.

### Dependency Graph

```
@point-grab/angular   â”€â”
@point-grab/react     â”€â”¤
@point-grab/vue       â”€â”¼â”€â”€> point-grab (core, peerDependency)
@point-grab/svelte    â”€â”¤
@point-grab/web-comp. â”€â”˜

@point-grab/mcp-server  (standalone, depends on @modelcontextprotocol/sdk)
```

Adapter packages list `point-grab` as a `peerDependency`. The MCP server is fully standalone -- it receives data over HTTP and has no browser-side code.

## Source Location Strategies

Each adapter uses a different strategy for resolving source locations:

| Adapter | Strategy | Dev-only? |
|---|---|---|
| Angular | Global `__POINT_GRAB_SOURCE_MAP__` (injected by build plugin) | Yes |
| React | `fiber._debugSource.{ fileName, lineNumber }` | Yes |
| Vue | `type.__file` on component options | Yes |
| Svelte | `__svelte_meta.loc.{ file, line, column }` | Yes |
| Web Components | `Constructor.__source` or `__POINT_GRAB_WC_SOURCE_MAP__` | Yes |

All source location data is stripped in production builds. The adapters gracefully return `null` when source info is unavailable.

## Browser -> Webhook -> MCP Pipeline

```
1. User clicks element in browser
       |
2. Core engine builds ElementContext + generates snippet
       |
3. Copies to clipboard (navigator.clipboard.writeText)
       |
4. MCP webhook plugin (auto-registered) fires onCopySuccess:
       POST http://localhost:3456/inspect
       Content-Type: application/json
       { html, componentName, filePath, line, column,
         componentStack, selector, cssClasses, framework, snippet }
       |
5. @point-grab/mcp-server receives POST:
   - Validates payload (requires html + componentName)
   - Appends to history (memory + ~/.point-grab/history.json)
   - Returns 200 OK
       |
6. AI agent calls MCP tool (e.g., point_grab_recent) over stdio:
   - MCP server reads history from disk
   - Returns matching captures
   - Agent uses context to locate and edit code
```

The webhook is simple HTTP POST. The MCP server serializes writes to prevent concurrent data loss. History persists to disk at `~/.point-grab/history.json` by default (configurable via `POINT_GRAB_HISTORY_PATH`).
