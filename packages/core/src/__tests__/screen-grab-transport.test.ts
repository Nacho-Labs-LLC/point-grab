import { afterEach, expect, it, vi } from 'vitest';
import { createMcpWebhookPlugin } from '../plugins/mcp-webhook-plugin';
import type { ElementContext } from '../types';
afterEach(() => vi.unstubAllGlobals());
it('does not call an old text-only server acknowledgement an image success', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, id: 'old-server' }), { status: 200 })));
  await expect(createMcpWebhookPlugin().hooks!.onScreenGrab!({ screenGrab: { data: 'png' } } as ElementContext, 'comment')).rejects.toThrow('image');
});
it('rejects HTTP failure instead of silently swallowing an image send', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 413 })));
  await expect(createMcpWebhookPlugin().hooks!.onScreenGrab!({} as ElementContext, 'comment')).rejects.toThrow('413');
});
