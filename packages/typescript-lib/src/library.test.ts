import {
  describe,
  expect,
  it
} from 'vitest';

import {
  DEFAULT_DEBUG_NAMESPACE,
  Library
} from './library.ts';

describe('Library', () => {
  it('should default to empty/false before init', () => {
    expect(Library.debugGuideUrl).toBe('');
    expect(Library.debugNamespace).toBe(DEFAULT_DEBUG_NAMESPACE);
    expect(Library.debugPrefixNamespace).toBe('');
    expect(Library.shouldPrintStackTrace).toBe(false);
  });

  it('should expose the injected debug guide URL after init', () => {
    Library.init({ debugGuideUrl: 'https://example.com/guide', debugPrefixNamespace: 'my-plugin:', shouldPrintStackTrace: true });
    expect(Library.debugGuideUrl).toBe('https://example.com/guide');
  });

  it('should expose the injected debug namespace after init', () => {
    Library.init({ debugNamespace: 'my-host', debugPrefixNamespace: '', shouldPrintStackTrace: false });
    expect(Library.debugNamespace).toBe('my-host');
  });

  it('should keep the default debug namespace when init supplies none', () => {
    Library.init({ debugPrefixNamespace: 'my-plugin:', shouldPrintStackTrace: false });
    expect(Library.debugNamespace).toBe(DEFAULT_DEBUG_NAMESPACE);
  });

  it('should expose the injected params via getters after init', () => {
    Library.init({ debugPrefixNamespace: 'my-plugin:', shouldPrintStackTrace: true });
    expect(Library.debugPrefixNamespace).toBe('my-plugin:');
    expect(Library.shouldPrintStackTrace).toBe(true);
  });

  it('should throw when init is called twice without a reset', () => {
    Library.init({ debugPrefixNamespace: 'a:', shouldPrintStackTrace: false });
    expect(() => {
      Library.init({ debugPrefixNamespace: 'b:', shouldPrintStackTrace: false });
    }).toThrow('already initialized');
  });

  it('should allow re-init after resetToDefault', () => {
    Library.init({ debugNamespace: 'a', debugPrefixNamespace: 'a:', shouldPrintStackTrace: true });
    Library.resetToDefault();
    expect(Library.debugNamespace).toBe(DEFAULT_DEBUG_NAMESPACE);
    expect(Library.shouldPrintStackTrace).toBe(false);
    expect(() => {
      Library.init({ debugPrefixNamespace: 'c:', shouldPrintStackTrace: false });
    }).not.toThrow();
    expect(Library.debugPrefixNamespace).toBe('c:');
  });
});
