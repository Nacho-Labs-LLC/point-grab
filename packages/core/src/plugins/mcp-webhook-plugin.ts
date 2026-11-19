import type { Plugin, ElementContext } from '../types';

const MCP_WEBHOOK_URL = 'http://localhost:3456/inspect';

export function createMcpWebhookPlugin(): Plugin {
  return {
    name: 'mcp-webhook',
    hooks: {
      async onScreenGrab(context: ElementContext, snippet: string) {
        const { element: _element, ...serializable } = context;
        const response = await fetch(MCP_WEBHOOK_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...serializable, snippet }),
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error(`Screen Grab send failed (HTTP ${response.status}).`);
        const result = await response.json();
        if (result.success !== true || result.imageAccepted !== true || typeof result.id !== 'string') throw new Error('The server did not acknowledge image support. Update @point-grab/mcp-server before sending Screen Grabs.');
      },
      onCopySuccess(snippet: string, context: ElementContext) {
        fetch(MCP_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            html: context.html,
            componentName: context.componentName,
            filePath: context.filePath,
            line: context.line,
            column: context.column,
            selector: context.selector,
            cssClasses: context.cssClasses,
            snippet,
            componentStack: context.componentStack.map((c) => ({
              name: c.name,
              filePath: c.filePath,
              line: c.line,
              column: c.column,
            })),
          }),
        }).catch(() => {});
      },
    },
  };
}
