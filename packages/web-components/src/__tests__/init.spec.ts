// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initPointGrabWebComponents,
  getPointGrabApi,
  registerPointGrabPlugin,
  disposePointGrab,
} from '../init';
import * as core from '@point-grab/core';

// Mock core functions
vi.mock('@point-grab/core', () => {
  const mockApi = {
    setComponentResolver: vi.fn(),
    setSourceResolver: vi.fn(),
    setElementFromPoint: vi.fn(),
    setOptions: vi.fn(),
    registerPlugin: vi.fn(),
    dispose: vi.fn(),
  };

  return {
    init: vi.fn(() => mockApi),
    createNoopApi: vi.fn(() => ({ ...mockApi, isNoop: true })),
  };
});

describe('initPointGrabWebComponents', () => {
  beforeEach(() => {
    // Reset global state
    disposePointGrab();
    vi.clearAllMocks();
    delete (globalThis as any).__POINT_GRAB_DEV__;
  });

  it('should initialize point-grab API and configure resolvers', () => {
    const api = initPointGrabWebComponents();

    expect(core.init).toHaveBeenCalled();
    expect(api).toBeDefined();

    // Verify it configures the instance
    expect(api.setComponentResolver).toHaveBeenCalled();
    expect(api.setSourceResolver).toHaveBeenCalled();
    expect(api.setElementFromPoint).toHaveBeenCalled();
    expect(api.setOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        classFilters: expect.any(Array),
        htmlCleaners: expect.any(Array),
      })
    );
  });

  it('should be idempotent (return the same instance on subsequent calls)', () => {
    const api1 = initPointGrabWebComponents();
    const api2 = initPointGrabWebComponents();

    expect(api1).toBe(api2);
    expect(core.init).toHaveBeenCalledTimes(1);
  });

  it('should pass options to core init', () => {
    const options = { triggerKey: 'Alt' } as any;
    initPointGrabWebComponents(options);

    expect(core.init).toHaveBeenCalledWith(options);
  });

  it('should return noop API if __POINT_GRAB_DEV__ is false', () => {
    (globalThis as any).__POINT_GRAB_DEV__ = false;

    const api = initPointGrabWebComponents();

    expect(core.createNoopApi).toHaveBeenCalled();
    expect(core.init).not.toHaveBeenCalled();
    expect((api as any).isNoop).toBe(true);
  });

  it('should initialize normally if __POINT_GRAB_DEV__ is false but devOnly is false', () => {
    (globalThis as any).__POINT_GRAB_DEV__ = false;

    const api = initPointGrabWebComponents({ devOnly: false });

    expect(core.init).toHaveBeenCalled();
    expect(core.createNoopApi).not.toHaveBeenCalled();
    expect((api as any).isNoop).toBeUndefined();
  });

  describe('helper functions', () => {
    it('getPointGrabApi should return the current instance', () => {
      expect(getPointGrabApi()).toBeNull();

      const api = initPointGrabWebComponents();

      expect(getPointGrabApi()).toBe(api);
    });

    it('registerPointGrabPlugin should register a plugin on the instance', () => {
      const api = initPointGrabWebComponents();
      const mockPlugin = { name: 'test-plugin' } as any;

      registerPointGrabPlugin(mockPlugin);

      expect(api.registerPlugin).toHaveBeenCalledWith(mockPlugin);
    });

    it('disposePointGrab should dispose the instance and set it to null', () => {
      const api = initPointGrabWebComponents();

      disposePointGrab();

      expect(api.dispose).toHaveBeenCalled();
      expect(getPointGrabApi()).toBeNull();
    });
  });
});
