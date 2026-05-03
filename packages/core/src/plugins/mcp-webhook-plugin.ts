import type { Plugin, ElementContext } from '../types';

const MCP_WEBHOOK_URL = 'http://localhost:3456/inspect';

export function createMcpWebhookPlugin(): Plugin {
  return {
    name: 'mcp-webhook',
    hooks: {
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
