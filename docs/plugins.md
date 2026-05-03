# Plugin Development Guide

Plugins extend pointgrab's behavior without modifying the core engine. They can react to lifecycle events, modify copied content, override theme colors, and inject setup/teardown logic.

## Plugin Interface

```typescript
interface Plugin {
  /** Unique name for this plugin. Used for registration/unregistration. */
  name: string;

  /** Hook implementations. All hooks are optional. */
  hooks?: PluginHooks;

  /** Theme color overrides applied when this plugin is registered. */
  theme?: Partial<Theme>;

  /** Option overrides merged when this plugin is registered. */
  options?: Partial<PointGrabOptions>;

  /**
   * Setup function called on registration. Receives the PointGrabAPI.
   * Return a cleanup function to be called on dispose.
   */
  setup?: (api: PointGrabAPI) => PluginCleanup | void;
}

type PluginCleanup = () => void;
```

## Hook Reference

All hooks are optional. Implement only the ones you need.

```typescript
interface PluginHooks {
  /** Called when the inspector is activated. */
  onActivate?(): void;

  /** Called when the inspector is deactivated. */
  onDeactivate?(): void;

  /** Called on every hover over a new element. Fires frequently -- keep it fast. */
  onElementHover?(element: Element): void;

  /**
   * Called when an element is selected (clicked).
   * Receives the full ElementContext before copy.
   */
  onElementSelect?(context: ElementContext): void;

  /** Called just before the snippet is copied to clipboard. */
  onBeforeCopy?(context: ElementContext): void;

  /**
   * Called after a successful clipboard write.
   * Receives the final snippet text and the context.
   */
  onCopySuccess?(text: string, context: ElementContext, prompt?: string): void;

  /** Called when clipboard write fails. */
  onCopyError?(error: Error): void;

  /**
   * Transform the snippet text before it's copied.
   * Must return the modified (or original) string.
   * This is the only hook that can modify the copied content.
   */
  transformCopyContent?(text: string, context: ElementContext): string;
}
```

### Hook Execution Order

Plugins execute in registration order. The full lifecycle for a capture:

```
activate()
  -> plugin1.onActivate() -> plugin2.onActivate() -> ...

[user hovers over element]
  -> plugin1.onElementHover(el) -> plugin2.onElementHover(el) -> ...

[user clicks element]
  -> buildElementContext()
  -> plugin1.onElementSelect(ctx) -> plugin2.onElementSelect(ctx) -> ...
  -> plugin1.onBeforeCopy(ctx) -> plugin2.onBeforeCopy(ctx) -> ...
  -> generateSnippet()
  -> plugin1.transformCopyContent(text, ctx) -> plugin2.transformCopyContent(text, ctx) -> ...
     (each receives the output of the previous)
  -> navigator.clipboard.writeText(finalText)
     success:
       -> plugin1.onCopySuccess(text, ctx) -> plugin2.onCopySuccess(text, ctx) -> ...
     failure:
       -> plugin1.onCopyError(error) -> plugin2.onCopyError(error) -> ...

deactivate()
  -> plugin1.onDeactivate() -> plugin2.onDeactivate() -> ...

dispose()
  -> cleanup functions returned from setup()
```

## Registration

```typescript
import { init, type Plugin } from 'pointgrab';

const myPlugin: Plugin = {
  name: 'my-plugin',
  hooks: {
    onCopySuccess(text, context) {
      console.log('Copied:', context.componentName);
    },
  },
};

const inspector = init();
inspector.registerPlugin(myPlugin);
```

On registration:
1. If `plugin.options` exists, it's merged into the current options
2. If `plugin.theme` exists, theme overrides are applied via the theme manager
3. If `plugin.setup` exists, it's called with the `PointGrabAPI` and the returned cleanup function is stored

Unregister by name:

```typescript
inspector.unregisterPlugin('my-plugin');
```

## The setup Function

For plugins that need to manage their own lifecycle (event listeners, intervals, DOM elements):

```typescript
const keyboardShortcutPlugin: Plugin = {
  name: 'keyboard-shortcut',
  setup(api) {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'i' && e.ctrlKey && e.shiftKey) {
        api.toggle();
      }
    };
    document.addEventListener('keydown', handler);

    // Return cleanup function -- called on dispose or unregister
    return () => {
      document.removeEventListener('keydown', handler);
    };
  },
};
```

## Option Overrides

A plugin can declare option overrides that are merged when registered:

```typescript
const verbosePlugin: Plugin = {
  name: 'verbose',
  hooks: {},
  options: {
    maxContextLines: 50,
  },
};
```

These are shallow-merged into the current options. The user's explicit `setOptions()` calls after registration will override them.

## Theme Overrides

Plugins can override any subset of theme colors:

```typescript
const catppuccinPlugin: Plugin = {
  name: 'catppuccin',
  theme: {
    overlayBorderColor: '#89b4fa',
    overlayBgColor: 'rgba(137, 180, 250, 0.1)',
    labelBgColor: '#1e1e2e',
    labelTextColor: '#cdd6f4',
    toolbarBgColor: '#1e1e2e',
    toolbarTextColor: '#cdd6f4',
    toolbarAccentColor: '#89b4fa',
    popoverBgColor: '#1e1e2e',
    popoverTextColor: '#cdd6f4',
    popoverBorderColor: '#45475a',
  },
};
```

### Available Theme Properties

```typescript
interface Theme {
  overlayBorderColor: string;
  overlayBgColor: string;
  labelBgColor: string;
  labelTextColor: string;
  toastBgColor: string;
  toastTextColor: string;
  toolbarBgColor: string;
  toolbarTextColor: string;
  toolbarAccentColor: string;
  popoverBgColor: string;
  popoverTextColor: string;
  popoverBorderColor: string;
}
```

## The transformCopyContent Hook

This is the only hook that can modify the text that gets copied to clipboard. It receives the generated snippet and must return a string:

```typescript
const jsonPlugin: Plugin = {
  name: 'json-output',
  hooks: {
    transformCopyContent(text, context) {
      // Replace the default text format with JSON
      return JSON.stringify({
        component: context.componentName,
        source: context.filePath,
        line: context.line,
        html: context.html,
        ancestors: context.componentStack.map(e => e.name),
      }, null, 2);
    },
  },
};
```

When multiple plugins implement `transformCopyContent`, they chain: each receives the output of the previous plugin.

## Reference Implementation: Built-in MCP Webhook Plugin

The core engine auto-registers an MCP webhook plugin when `mcpWebhook: true` (default). Here is the pattern it follows:

```typescript
import type { Plugin, ElementContext } from 'pointgrab';

export function createMcpWebhookPlugin(): Plugin {
  return {
    name: 'mcp-webhook',
    hooks: {
      onCopySuccess(text: string, context: ElementContext) {
        // Fire-and-forget POST to the MCP server
        const payload = {
          html: context.html,
          componentName: context.componentName,
          filePath: context.filePath,
          line: context.line,
          column: context.column,
          componentStack: context.componentStack,
          selector: context.selector,
          cssClasses: context.cssClasses,
          snippet: text,
        };

        fetch('http://localhost:3456/inspect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {
          // Silently ignore -- MCP server might not be running
        });
      },
    },
  };
}
```

Key design decisions:
- Uses `onCopySuccess` (not `onElementSelect`) so it only fires after a successful clipboard write
- Fire-and-forget `fetch` -- never blocks the UI
- Silently catches errors -- the MCP server may not be running

## Example: Building a Screenshot Plugin

A plugin that captures a screenshot of the selected element using `html2canvas`:

```typescript
import type { Plugin, ElementContext } from 'pointgrab';

interface ScreenshotPluginOptions {
  output?: 'download' | 'clipboard';
  scale?: number;
}

export function createScreenshotPlugin(options: ScreenshotPluginOptions = {}): Plugin {
  const { output = 'download', scale = 2 } = options;

  return {
    name: 'screenshot',
    hooks: {
      onCopySuccess(_text: string, context: ElementContext) {
        captureScreenshot(context.element, context.componentName, output, scale);
      },
    },
  };
}

async function captureScreenshot(
  element: Element,
  componentName: string | null,
  output: 'download' | 'clipboard',
  scale: number,
): Promise<void> {
  try {
    const { default: html2canvas } = await import('html2canvas');

    const canvas = await html2canvas(element as HTMLElement, {
      scale,
      useCORS: true,
      logging: false,
    });

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
        'image/png',
      );
    });

    if (output === 'download') {
      const name = componentName ?? element.tagName.toLowerCase();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pointgrab-${name}-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
    }
  } catch (err) {
    console.error('[pointgrab:screenshot] Failed:', err);
  }
}
```

Usage:

```typescript
import { init } from 'pointgrab';
import { createScreenshotPlugin } from './screenshot-plugin';

const inspector = init();
inspector.registerPlugin(createScreenshotPlugin({ output: 'download' }));
```

## Example: Analytics Plugin

Track which components are inspected most often:

```typescript
import type { Plugin, ElementContext } from 'pointgrab';

export function createAnalyticsPlugin(endpoint: string): Plugin {
  const counts = new Map<string, number>();

  return {
    name: 'analytics',
    hooks: {
      onElementSelect(context: ElementContext) {
        const key = context.componentName ?? context.selector;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      },
    },
    setup(api) {
      // Flush counts periodically
      const interval = setInterval(() => {
        if (counts.size === 0) return;
        const data = Object.fromEntries(counts);
        counts.clear();
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }).catch(() => {});
      }, 30_000);

      return () => clearInterval(interval);
    },
  };
}
```

## Guidelines

**Keep hooks fast.** `onElementHover` fires on every mouse movement during selection. Do minimal work. Defer heavy operations to `onCopySuccess`.

**Clean up in setup's return function.** Remove any DOM elements, event listeners, or timers your plugin created.

**Don't throw from hooks.** Catch errors internally. An uncaught exception in a hook will propagate up.

**Use `transformCopyContent` to modify output.** This is the only sanctioned way to change what gets copied. Don't try to intercept the clipboard in other hooks.

**Use `onCopySuccess` for side effects.** Webhooks, logging, analytics, screenshots -- anything that shouldn't block the clipboard write.
