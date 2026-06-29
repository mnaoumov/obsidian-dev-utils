import {
  describe,
  expect,
  it
} from 'vitest';

import { Library } from './library.ts';

describe('Library', () => {
  it('should default to empty/false before init', () => {
    expect(Library.cssClassScope).toBe('');
    expect(Library.debugPrefixNamespace).toBe('');
    expect(Library.shouldPrintStackTrace).toBe(false);
  });

  it('should expose the injected params via getters after init', () => {
    Library.init({ cssClassScope: 'my-plugin', debugPrefixNamespace: 'my-plugin:', shouldPrintStackTrace: true });
    expect(Library.cssClassScope).toBe('my-plugin');
    expect(Library.debugPrefixNamespace).toBe('my-plugin:');
    expect(Library.shouldPrintStackTrace).toBe(true);
  });

  it('should throw when init is called twice without a reset', () => {
    Library.init({ cssClassScope: 'a', debugPrefixNamespace: 'a:', shouldPrintStackTrace: false });
    expect(() => {
      Library.init({ cssClassScope: 'b', debugPrefixNamespace: 'b:', shouldPrintStackTrace: false });
    }).toThrow('already initialized');
  });

  it('should allow re-init after resetToDefault', () => {
    Library.init({ cssClassScope: 'a', debugPrefixNamespace: 'a:', shouldPrintStackTrace: true });
    Library.resetToDefault();
    expect(Library.cssClassScope).toBe('');
    expect(Library.shouldPrintStackTrace).toBe(false);
    expect(() => {
      Library.init({ cssClassScope: 'c', debugPrefixNamespace: 'c:', shouldPrintStackTrace: false });
    }).not.toThrow();
    expect(Library.cssClassScope).toBe('c');
  });
});
