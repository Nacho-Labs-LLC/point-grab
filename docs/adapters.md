# Writing Custom Adapters

Adapters teach pointgrab how to extract component metadata from a specific framework. If your framework isn't covered by the built-in adapters, you can write your own.

## The Two Function Types

An adapter implements two resolver functions and registers them with the core engine:

```typescript
type ComponentResolver = (element: Element) => {
  /** Display name of the closest component */
  name: string | null;
  /** The DOM element that hosts this component */
  hostElement: Element | null;
  /** Ancestor component chain, closest first */
  stack?: Array<{ name: string; hostElement: Element | null }>;
} | null;

type SourceResolver = (element: Element) => {
  /** Relative file path (e.g., "src/components/UserCard.tsx") */
  filePath: string | null;
  /** Line number (1-indexed) */
  line: number | null;
  /** Column number (0-indexed) */
  column: number | null;
} | null;
```

Both are plain functions that receive an `Element` and return metadata or `null`. They are not class instances with multiple methods -- the core engine calls them directly.

## Wiring Up an Adapter

Register your resolvers with an pointgrab instance:

```typescript
import { init } from 'pointgrab';

const inspector = init();
inspector.setComponentResolver((el) => resolveComponent(el));
inspector.setSourceResolver((el) => resolveSource(el));
```

Only one `ComponentResolver` and one `SourceResolver` can be active at a time. Setting a new one replaces the previous.

## Class Filters and HTML Cleaners

Frameworks inject internal attributes and classes that clutter captured HTML. Your adapter should register filters to strip them.

### ClassFilter

A function that returns `true` to keep a class, `false` to strip it:

```typescript
import type { ClassFilter } from 'pointgrab';

// Strip classes starting with "qwik-" or "q:"
const qwikClassFilter: ClassFilter = (className: string) =>
  !className.startsWith('qwik-') && !className.startsWith('q:');
```

### HtmlCleaner

A regex/replacer pair applied to the raw `outerHTML` string:

```typescript
import type { HtmlCleaner } from 'pointgrab';

// Strip q:id, q:key, q:container attributes
const qwikHtmlCleaners: HtmlCleaner[] = [
  { pattern: /\sq:(?:id|key|container|version|render|base)(?:="[^"]*")?/gi, replacement: '' },
  { pattern: /\son:q(?:visible|init)(?:="[^"]*")?/gi, replacement: '' },
];
```

Register them via `setOptions`:

```typescript
inspector.setOptions({
  classFilters: [qwikClassFilter],
  htmlCleaners: qwikHtmlCleaners,
});
```

The core engine uses `filterFrameworkClasses()` (applies all `ClassFilter` functions -- a class is kept only if every filter returns `true`) and `cleanFrameworkAttrs()` (applies each `HtmlCleaner` regex in sequence).

## Example: Building a Qwik Adapter

[Qwik](https://qwik.dev/) uses a unique resumability model. Let's build a full adapter.

### Step 1: Understand the Framework's Debug Surface

Every framework exposes component information differently in the DOM. Research your framework by inspecting elements in browser devtools. Look for:

- Special properties on DOM elements (`__reactFiber$`, `__vue__`, `__svelte_meta`, etc.)
- Global debug APIs (`window.ng`, `window.__REACT_DEVTOOLS_GLOBAL_HOOK__`, etc.)
- Attributes added to elements (`q:id`, `_nghost-*`, `data-v-*`, etc.)

For Qwik:
- Components are marked with `q:id` attributes on their root elements
- In dev mode, `element.__q_component__` gives access to the component instance
- Source locations are available via `__q_component__._dev.$file$` and `_dev.$line$`

### Step 2: Implement ComponentResolver

```typescript
// packages/qwik/src/resolvers/component-resolver.ts

interface ComponentResult {
  name: string | null;
  hostElement: Element | null;
  stack: Array<{ name: string; hostElement: Element | null }>;
}

export function resolveComponent(element: Element): ComponentResult {
  const stack: Array<{ name: string; hostElement: Element | null }> = [];
  const seen = new Set<object>();

  let current: Element | null = element;
  while (current) {
    const qComponent = (current as any).__q_component__;
    if (qComponent && typeof qComponent === 'object' && !seen.has(qComponent)) {
      seen.add(qComponent);
      const name = qComponent.$componentQrl$?.$symbol$ ?? null;
      if (name) {
        stack.push({ name, hostElement: current });
      }
    }
    current = current.parentElement;
  }

  const closest = stack.length > 0 ? stack[0] : { name: null, hostElement: null };

  return {
    name: closest.name,
    hostElement: closest.hostElement,
    stack,
  };
}
```

Key patterns from the built-in adapters:
- Use a `seen` set to prevent duplicate entries (Angular uses `Set<object>`, React uses `Set<FiberNode>`)
- Walk up from the element collecting every component boundary
- Return the closest (first) component as `name`/`hostElement`, plus the full `stack`
- Return `{ name: null, hostElement: null, stack: [] }` when nothing is found

### Step 3: Implement SourceResolver

```typescript
// packages/qwik/src/resolvers/source-resolver.ts

interface SourceResult {
  filePath: string | null;
  line: number | null;
  column: number | null;
}

export function resolveSource(element: Element): SourceResult {
  // Walk up to find the nearest element with Qwik dev info
  let current: Element | null = element;
  while (current) {
    const qComponent = (current as any).__q_component__;
    if (qComponent?._dev) {
      const dev = qComponent._dev;
      if (dev.$file$) {
        return {
          filePath: dev.$file$,
          line: dev.$line$ ?? null,
          column: dev.$column$ ?? null,
        };
      }
    }
    current = current.parentElement;
  }

  return { filePath: null, line: null, column: null };
}
```

### Step 4: Define Filters

```typescript
// packages/qwik/src/filters.ts
import type { ClassFilter, HtmlCleaner } from 'pointgrab';

export const qwikClassFilter: ClassFilter = (className: string) =>
  !className.startsWith('qwik-') && !className.startsWith('q:');

export const qwikHtmlCleaners: HtmlCleaner[] = [
  { pattern: /\sq:(?:id|key|container|version|render|base)(?:="[^"]*")?/gi, replacement: '' },
  { pattern: /\son:q(?:visible|init)(?:="[^"]*")?/gi, replacement: '' },
];
```

### Step 5: Create the Init Function

Follow the same idempotent singleton pattern as all built-in adapters:

```typescript
// packages/qwik/src/init.ts
import { init, createNoopApi } from 'pointgrab';
import type { PointGrabAPI, PointGrabOptions, Plugin } from 'pointgrab';
import { resolveComponent } from './resolvers/component-resolver';
import { resolveSource } from './resolvers/source-resolver';
import { qwikClassFilter, qwikHtmlCleaners } from './filters';

let instance: PointGrabAPI | null = null;

export function initPointGrabQwik(options?: Partial<PointGrabOptions>): PointGrabAPI {
  if (instance) return instance;

  // No-op in production when devOnly is requested
  if (options?.devOnly !== false && typeof process !== 'undefined' &&
      (process as Record<string, unknown>).env &&
      (process.env as Record<string, string>).NODE_ENV === 'production') {
    instance = createNoopApi();
    return instance;
  }

  instance = init(options);
  instance.setComponentResolver((el) => resolveComponent(el));
  instance.setSourceResolver((el) => resolveSource(el));
  instance.setOptions({
    classFilters: [qwikClassFilter],
    htmlCleaners: qwikHtmlCleaners,
  });

  return instance;
}

export function getPointGrabApi(): PointGrabAPI | null {
  return instance;
}

export function registerPointGrabPlugin(plugin: Plugin): void {
  instance?.registerPlugin(plugin);
}

export function disposePointGrab(): void {
  instance?.dispose();
  instance = null;
}
```

### Step 6: Framework-Specific Integration

For Qwik, you might expose a hook that integrates with Qwik's lifecycle:

```typescript
// packages/qwik/src/use-pointgrab.ts
import { useVisibleTask$ } from '@builder.io/qwik';
import type { PointGrabOptions } from 'pointgrab';
import { initPointGrabQwik, disposePointGrab } from './init';

export function usePointGrab(options?: Partial<PointGrabOptions>): void {
  useVisibleTask$(() => {
    initPointGrabQwik(options);
    return () => disposePointGrab();
  });
}
```

## Testing Adapters

### Unit Testing the Resolver

Test `resolveComponent()` and `resolveSource()` against mock DOM elements:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveComponent } from './resolvers/component-resolver';

describe('resolveComponent', () => {
  it('resolves component from __q_component__', () => {
    const el = document.createElement('div');
    (el as any).__q_component__ = {
      $componentQrl$: { $symbol$: 'UserCard' },
      _dev: { $file$: 'src/UserCard.tsx', $line$: 5 },
    };

    const result = resolveComponent(el);
    expect(result.name).toBe('UserCard');
    expect(result.hostElement).toBe(el);
    expect(result.stack).toHaveLength(1);
  });

  it('returns null name for plain elements', () => {
    const el = document.createElement('div');
    const result = resolveComponent(el);
    expect(result.name).toBeNull();
    expect(result.stack).toHaveLength(0);
  });

  it('walks up the DOM to build component stack', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    parent.appendChild(child);

    (parent as any).__q_component__ = {
      $componentQrl$: { $symbol$: 'Layout' },
    };

    const result = resolveComponent(child);
    expect(result.name).toBe('Layout');
    expect(result.stack).toHaveLength(1);
    expect(result.stack[0].name).toBe('Layout');
  });
});
```

### Integration Testing

Test against a real framework app using Playwright:

```typescript
import { test, expect } from '@playwright/test';

test('pointgrab resolves Qwik components', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Inject and activate pointgrab
  await page.evaluate(() => {
    const { initPointGrabQwik } = (window as any).__pointgrabTest__;
    const inspector = initPointGrabQwik({ activationMode: 'toggle' });
    inspector.activate();
  });

  // Hover and click a component
  await page.hover('[q\\:id]');
  await page.click('[q\\:id]');

  // Check clipboard content
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toContain('UserCard');
});
```

### Performance

`ComponentResolver` is called on every `mousemove` event during selection. Keep it fast:

- `hasAttribute()` and `in` checks are fast
- Walking `parentElement` is fast
- Avoid `querySelectorAll()`, `getComputedStyle()`, or string parsing in the hot path
- Use a `Set` to prevent re-processing elements you've already visited

## Checklist

Before publishing a custom adapter:

- [ ] `resolveComponent()` handles missing debug info gracefully (returns `{ name: null, ... }`, never throws)
- [ ] `resolveSource()` returns `{ filePath: null, line: null, column: null }` when source info is unavailable
- [ ] Component stack is built by walking up from the element, closest first
- [ ] `seen` set prevents duplicate stack entries
- [ ] `ClassFilter` strips framework-specific classes
- [ ] `HtmlCleaner` regex pairs strip framework-specific attributes
- [ ] Init function is idempotent (returns existing instance on subsequent calls)
- [ ] Production guard returns `createNoopApi()` when appropriate
- [ ] Unit tests cover resolve, source, and edge cases (missing data, detached elements)
- [ ] Package exports init function, individual resolvers, and filters
