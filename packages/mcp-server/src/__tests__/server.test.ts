import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  ResourceListChangedNotificationSchema,
  ResourceUpdatedNotificationSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { GrabContext, GrabHistory } from '../types.js';
import {
  createPointGrabMcpServer,
  type AddGrabResult,
  type HistoryStore,
} from '../server.js';

function readTextContent(contents: Array<{ text?: string } | { blob?: string }>): string {
  const [first] = contents;
  if (!first || !('text' in first) || typeof first.text !== 'string') {
    throw new Error('Expected text resource content');
  }

  return first.text;
}

function makeContext(overrides: Partial<GrabContext> = {}): GrabContext {
  return {
    html: '<button class="save-btn">Save</button>',
    componentName: 'SaveButton',
    filePath: 'src/components/SaveButton.tsx',
    line: 12,
    column: 3,
    componentStack: [
      {
        name: 'SaveButton',
        filePath: 'src/components/SaveButton.tsx',
        line: 12,
        column: 3,
      },
    ],
    selector: 'button.save-btn',
    cssClasses: ['save-btn'],
    textContent: 'Save',
    ariaLabel: null,
    role: 'button',
    elementDescription: 'Save button',
    framework: 'react',
    sessionId: null,
    ...overrides,
  };
}

function createMemoryHistoryStore(seed: GrabHistory = { entries: [], maxEntries: 50 }): HistoryStore {
  let history: GrabHistory = structuredClone(seed);

  return {
    async ensureHistoryFile() {},
    async readHistory() {
      return structuredClone(history);
    },
    async addGrab(context, snippet) {
      const previous = structuredClone(history);
      const entry = {
        id: `${history.entries.length + 1}`,
        context,
        snippet,
        timestamp: Date.now() + history.entries.length,
      };
      history = {
        ...history,
        entries: [entry, ...history.entries].slice(0, history.maxEntries),
      };

      const previousSessions = previous.entries
        .map((candidate) => candidate.context.sessionId)
        .filter((candidate): candidate is string => Boolean(candidate));
      const nextSessions = history.entries
        .map((candidate) => candidate.context.sessionId)
        .filter((candidate): candidate is string => Boolean(candidate));

      const resourcesListChanged =
        previous.entries.length === 0 ||
        previousSessions.join('\u0000') !== nextSessions.join('\u0000');

      return {
        entry,
        history: structuredClone(history),
        resourcesListChanged,
      } satisfies AddGrabResult;
    },
  };
}

async function connectServer(historyStore: HistoryStore) {
  const pointGrabServer = createPointGrabMcpServer({ historyStore });
  const client = new Client(
    { name: 'point-grab-test-client', version: '0.0.0' },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([
    pointGrabServer.server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return { client, pointGrabServer };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('point-grab MCP resources', () => {
  it('lists additive resources and templates with annotations', async () => {
    const historyStore = createMemoryHistoryStore({
      maxEntries: 50,
      entries: [
        {
          id: 'capture-1',
          timestamp: Date.UTC(2026, 0, 1, 12, 0, 0),
          snippet: '<button>Save</button>',
          context: makeContext({ sessionId: 'session-a' }),
        },
      ],
    });
    const { client } = await connectServer(historyStore);

    const resources = await client.listResources();
    const templates = await client.listResourceTemplates();

    expect(resources.resources.map((resource) => resource.uri)).toEqual([
      'pointgrab://captures',
      'pointgrab://captures/latest',
      'pointgrab://sessions/session-a/captures',
    ]);
    expect(resources.resources[0].annotations?.audience).toEqual(['user']);
    expect(resources.resources[1].annotations?.audience).toEqual(['user', 'assistant']);
    expect(resources.resources[1].annotations?.lastModified).toBe('2026-01-01T12:00:00.000Z');

    expect(templates.resourceTemplates.map((template) => template.uriTemplate)).toEqual([
      'pointgrab://captures/{captureId}',
      'pointgrab://sessions/{sessionId}/captures',
      'pointgrab://sessions/{sessionId}/captures/latest',
      'pointgrab://sessions/{sessionId}/captures/{captureId}',
    ]);
  });

  it('reads latest, capture-by-id, and session-scoped resources', async () => {
    const historyStore = createMemoryHistoryStore({
      maxEntries: 50,
      entries: [
        {
          id: 'capture-2',
          timestamp: Date.UTC(2026, 0, 2, 12, 0, 0),
          snippet: '<button>Publish</button>',
          context: makeContext({
            componentName: 'PublishButton',
            selector: 'button.publish-btn',
            sessionId: 'session-b',
          }),
        },
        {
          id: 'capture-1',
          timestamp: Date.UTC(2026, 0, 1, 12, 0, 0),
          snippet: '<button>Save</button>',
          context: makeContext({ sessionId: 'session-a' }),
        },
      ],
    });
    const { client } = await connectServer(historyStore);

    const latest = await client.readResource({ uri: 'pointgrab://captures/latest' });
    const captureById = await client.readResource({ uri: 'pointgrab://captures/capture-1' });
    const sessionIndex = await client.readResource({
      uri: 'pointgrab://sessions/session-b/captures',
    });

    expect(JSON.parse(readTextContent(latest.contents))).toMatchObject({
      id: 'capture-2',
      context: { sessionId: 'session-b' },
    });
    expect(JSON.parse(readTextContent(captureById.contents))).toMatchObject({
      id: 'capture-1',
      context: { sessionId: 'session-a' },
    });
    expect(JSON.parse(readTextContent(sessionIndex.contents))).toMatchObject({
      resource: 'pointgrab://sessions/session-b/captures',
      totalCaptures: 1,
      captures: [{ id: 'capture-2', sessionId: 'session-b' }],
    });
  });

  it('accepts incoming grabs without a component name for vanilla captures', async () => {
    const historyStore = createMemoryHistoryStore();
    const { pointGrabServer } = await connectServer(historyStore);

    const entry = await pointGrabServer.processIncomingGrab({
      html: '<div class="plain-card">Plain</div>',
      componentName: null,
      selector: 'div.plain-card',
      cssClasses: ['plain-card'],
      snippet: '<div class="plain-card">Plain</div>',
      framework: null,
    });

    expect(entry.context.componentName).toBeNull();
    expect(entry.context.selector).toBe('div.plain-card');
  });

  it('keeps tool text results and appends capture resource links', async () => {
    const historyStore = createMemoryHistoryStore({
      maxEntries: 50,
      entries: [
        {
          id: 'capture-1',
          timestamp: Date.UTC(2026, 0, 1, 12, 0, 0),
          snippet: '<button>Save</button>',
          context: makeContext(),
        },
      ],
    });
    const { client } = await connectServer(historyStore);

    const result = await client.callTool({
      name: 'point_grab_recent',
      arguments: { limit: 1 },
    });
    const content = result.content as Array<{ type: string; uri?: string }>;

    expect(content[0]).toMatchObject({ type: 'text' });
    expect(content.some((item) => item.type === 'resource_link')).toBe(true);
    expect(content.filter((item) => item.type === 'resource_link').map((item) => item.uri)).toEqual([
      'pointgrab://captures',
      'pointgrab://captures/latest',
      'pointgrab://captures/capture-1',
    ]);
  });

  it('emits resource update notifications and list-changed on new top-level resources', async () => {
    const historyStore = createMemoryHistoryStore();
    const { client, pointGrabServer } = await connectServer(historyStore);
    const updatedUris: string[] = [];
    const listChanged = vi.fn();

    client.setNotificationHandler(ResourceUpdatedNotificationSchema, (notification) => {
      updatedUris.push(notification.params.uri);
    });
    client.setNotificationHandler(ResourceListChangedNotificationSchema, () => {
      listChanged();
    });

    await client.subscribeResource({ uri: 'pointgrab://captures' });
    await client.subscribeResource({ uri: 'pointgrab://captures/latest' });
    await client.subscribeResource({ uri: 'pointgrab://sessions/session-a/captures' });

    await pointGrabServer.addGrab(
      makeContext({ sessionId: 'session-a' }),
      '<button>Save</button>'
    );

    expect(updatedUris).toEqual([
      'pointgrab://captures',
      'pointgrab://captures/latest',
      'pointgrab://sessions/session-a/captures',
    ]);
    expect(listChanged).toHaveBeenCalledTimes(1);
  });
});
