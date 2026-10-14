import { webcrypto } from 'node:crypto';
import { ReadableStream } from 'node:stream/web';
import {
  describe,
  expect,
  it
} from 'vitest';

import {
  NODE_WEB_GLOBAL_NAMES,
  restoreNodeWebGlobals
} from './node-web-globals.ts';

describe('restoreNodeWebGlobals', () => {
  it('should define every missing name from the Node module that exports it', () => {
    const target = {};
    restoreNodeWebGlobals(target);

    expect(Reflect.get(target, 'ReadableStream')).toBe(ReadableStream);
    expect(Reflect.get(target, 'crypto')).toBe(webcrypto);
    expect(Reflect.get(target, 'SubtleCrypto')).toBe(webcrypto.subtle.constructor);

    for (const name of NODE_WEB_GLOBAL_NAMES) {
      // eslint-disable-next-line obsidianmd/no-global-this -- Intentional: this runs under `environment: 'node'` as well as `jsdom`, and `window` is undefined in the former.
      if (name === 'URLPattern' && !('URLPattern' in globalThis)) {
        continue;
      }

      expect(Reflect.get(target, name), name).toBeDefined();
      expect(Object.getOwnPropertyDescriptor(target, name)).toMatchObject({ configurable: true, enumerable: false, writable: true });
    }
  });

  it('should leave every name that is already present untouched', () => {
    const existing = Symbol('existing');
    const crypto = { subtle: existing };
    const target: Record<string, unknown> = { crypto, ReadableStream: existing, SubtleCrypto: existing };
    restoreNodeWebGlobals(target);

    expect(target['ReadableStream']).toBe(existing);
    expect(target['SubtleCrypto']).toBe(existing);
    expect(target['crypto']).toBe(crypto);
    expect(crypto.subtle).toBe(existing);
  });

  it('should add subtle to a crypto object that lacks it, as a VM-backed jsdom context has', () => {
    const crypto = { getRandomValues: webcrypto.getRandomValues };
    const target = { crypto };
    restoreNodeWebGlobals(target);

    expect(Reflect.get(crypto, 'subtle')).toBe(webcrypto.subtle);
  });

  it('should leave a crypto value that is not an object alone', () => {
    const target = { crypto: null };
    restoreNodeWebGlobals(target);

    expect(target.crypto).toBeNull();
  });

  it('should default to globalThis, where Node already provides every name', () => {
    expect(() => {
      restoreNodeWebGlobals();
    }).not.toThrow();
    // eslint-disable-next-line obsidianmd/no-global-this -- Intentional: this runs under `environment: 'node'` as well as `jsdom`, and `window` is undefined in the former.
    expect(globalThis.ReadableStream).toBe(ReadableStream);
  });
});
