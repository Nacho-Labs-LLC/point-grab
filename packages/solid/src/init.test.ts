import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = {
  setComponentResolver: vi.fn(),
  setSourceResolver: vi.fn(),
  setOptions: vi.fn(),
  registerPlugin: vi.fn(),
  dispose: vi.fn(),
};

vi.mock('@point-grab/core', () => ({
  createNoopApi: vi.fn(),
  init: vi.fn(() => api),
}));

import { disposePointGrab, initPointGrabSolid } from './init';
import { init } from '@point-grab/core';

describe('initPointGrabSolid', () => {
  beforeEach(() => {
    disposePointGrab();
    vi.clearAllMocks();
  });

  it('installs Solid resolvers and HTML cleanup on the core instance', () => {
    expect(initPointGrabSolid()).toBe(api);

    expect(init).toHaveBeenCalledOnce();
    expect(api.setComponentResolver).toHaveBeenCalledOnce();
    expect(api.setSourceResolver).toHaveBeenCalledOnce();
    expect(api.setOptions).toHaveBeenCalledWith({
      classFilters: [expect.any(Function)],
      htmlCleaners: expect.any(Array),
    });
  });

  it('reuses a single core instance', () => {
    initPointGrabSolid();
    initPointGrabSolid();

    expect(init).toHaveBeenCalledOnce();
  });
});
