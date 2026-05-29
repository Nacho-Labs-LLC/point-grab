// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isMac } from '../keyboard/keyboard-handler';

describe('isMac', () => {
  let originalNavigator: Navigator | undefined;

  beforeEach(() => {
    originalNavigator = global.navigator;
  });

  afterEach(() => {
    if (originalNavigator === undefined) {
      // If it was undefined, we delete the property
      delete (global as any).navigator;
    } else {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        configurable: true,
        writable: true,
      });
    }
  });

  function setNavigator(mockNav: any) {
    if (mockNav === undefined) {
      Object.defineProperty(global, 'navigator', {
        value: undefined,
        configurable: true,
        writable: true,
      });
    } else {
      Object.defineProperty(global, 'navigator', {
        value: mockNav,
        configurable: true,
        writable: true,
      });
    }
  }

  it('should return false if navigator is undefined', () => {
    setNavigator(undefined);
    expect(isMac()).toBe(false);
  });

  it('should return true if navigator.userAgentData.platform contains mac', () => {
    setNavigator({
      userAgentData: { platform: 'macOS' },
      userAgent: 'Windows NT 10.0', // Fallback shouldn't be used
    });
    expect(isMac()).toBe(true);
  });

  it('should return false if navigator.userAgentData.platform is not mac', () => {
    setNavigator({
      userAgentData: { platform: 'Windows' },
      userAgent: 'Macintosh', // Fallback shouldn't be used, uaData takes precedence
    });
    expect(isMac()).toBe(false);
  });

  it('should fallback to userAgent and return true for Mac', () => {
    setNavigator({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    });
    expect(isMac()).toBe(true);
  });

  it('should fallback to userAgent and return true for iPhone', () => {
    setNavigator({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
    });
    expect(isMac()).toBe(true);
  });

  it('should fallback to userAgent and return true for iPad', () => {
    setNavigator({
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)',
    });
    expect(isMac()).toBe(true);
  });

  it('should fallback to userAgent and return true for iPod', () => {
    setNavigator({
      userAgent: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 14_5 like Mac OS X)',
    });
    expect(isMac()).toBe(true);
  });

  it('should fallback to userAgent and return false for Windows', () => {
    setNavigator({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });
    expect(isMac()).toBe(false);
  });

  it('should fallback to userAgent and return false for Linux', () => {
    setNavigator({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
    });
    expect(isMac()).toBe(false);
  });
});
