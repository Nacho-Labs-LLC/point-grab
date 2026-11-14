import { beforeEach, expect, it, vi } from 'vitest';

const api = { setComponentResolver: vi.fn(), setSourceResolver: vi.fn(), setOptions: vi.fn(), registerPlugin: vi.fn(), dispose: vi.fn() };
vi.mock('@point-grab/core', async (original) => ({ ...(await original<object>()), createNoopApi: vi.fn(), init: vi.fn(() => api) }));

import { disposePointGrab, initPointGrabSvelte } from '../init';

beforeEach(() => { disposePointGrab(); vi.clearAllMocks(); });

it('keeps caller-provided class filters and HTML cleaners alongside the adapter defaults', () => {
  const classFilter = () => false;
  const cleaner = { pattern: /private/g, replacement: '' };
  initPointGrabSvelte({ devOnly: false, classFilters: [classFilter], htmlCleaners: [cleaner] });
  const { classFilters, htmlCleaners } = api.setOptions.mock.calls.at(-1)![0];
  expect(classFilters).toContain(classFilter);
  expect(classFilters.length).toBeGreaterThan(1);
  expect(htmlCleaners).toContain(cleaner);
});
