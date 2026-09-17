/**
 * @file
 *
 * Puts back the Web API globals Node provides but a VM-backed Vitest pool's `jsdom` context lacks.
 *
 * Under the default pool a test sees Node's global object with the `jsdom` window laid over it, so
 * `crypto.subtle`, the Web Streams classes, `CompressionStream`, the `Performance*` classes and
 * `URLPattern` are all there. Under `vmThreads` / `vmForks` the test's global object IS the `jsdom`
 * window, and Vitest copies only a fixed handful of Node globals into it (`structuredClone`, `fetch`,
 * `TextEncoder`, …), so those are simply absent. Measured on Node 26 with `jsdom`: `crypto` exists without
 * `subtle`, and 31 global names present under `forks` are missing under `vmThreads` — the ones restored
 * here, plus `CryptoKey` and `QuotaExceededError`, which no Node module exports, and `matchMedia`,
 * `createPopup`, `scrollLeft` and `scrollTop`, which are not Node's to give.
 *
 * Absence is the dangerous failure, not the loud one. A call such as `crypto.subtle.digest` throws and is
 * noticed, but code that feature-detects (`typeof CompressionStream !== 'undefined'`) silently takes its
 * fallback branch, so the suite passes while testing a path Obsidian's Electron renderer — which has
 * every one of these — never runs. {@link restoreNodeWebGlobals} closes that gap by defining each
 * missing name from Node's own module that exports it, and leaves every name already present alone, so it
 * is a no-op under the default pool.
 */

import { webcrypto } from 'node:crypto';
/* eslint-disable import-x/no-namespace -- Read by name at run time, so a name one Node version lacks (`URLPattern` arrived in `node:url` after Node 22) reads as absent instead of failing the module at link time. */
import * as perfHooks from 'node:perf_hooks';
import * as streamWeb from 'node:stream/web';
import * as url from 'node:url';
/* eslint-enable import-x/no-namespace -- Only the three module namespaces above. */

/**
 * The Node modules the restored globals are read from, each one searched for every name.
 *
 * A namespace lookup rather than named imports, because a name one Node version lacks (`URLPattern`
 * arrived in `node:url` after Node 22) would otherwise fail the whole module at link time.
 */
const NODE_WEB_GLOBAL_SOURCES: readonly object[] = [streamWeb, perfHooks, url];

/**
 * The global names a VM-backed `jsdom` context lacks and a Node module exports under the same name.
 */
export const NODE_WEB_GLOBAL_NAMES = [
  'ByteLengthQueuingStrategy',
  'CompressionStream',
  'CountQueuingStrategy',
  'DecompressionStream',
  'PerformanceEntry',
  'PerformanceMark',
  'PerformanceMeasure',
  'PerformanceObserver',
  'PerformanceObserverEntryList',
  'PerformanceResourceTiming',
  'ReadableByteStreamController',
  'ReadableStream',
  'ReadableStreamBYOBReader',
  'ReadableStreamBYOBRequest',
  'ReadableStreamDefaultController',
  'ReadableStreamDefaultReader',
  'TextDecoderStream',
  'TextEncoderStream',
  'TransformStream',
  'TransformStreamDefaultController',
  'URLPattern',
  'WritableStream',
  'WritableStreamDefaultController',
  'WritableStreamDefaultWriter'
] as const;

/**
 * Defines every Node Web API global that is missing from `target`, plus `crypto.subtle` and
 * `SubtleCrypto`, leaving whatever is already present untouched.
 *
 * @param target - The global object to fill in. Defaults to `globalThis`.
 */
// eslint-disable-next-line obsidianmd/no-global-this -- Intentional: this runs under `environment: 'node'` as well as `jsdom`, and `window` is undefined in the former.
export function restoreNodeWebGlobals(target: object = globalThis): void {
  for (const source of NODE_WEB_GLOBAL_SOURCES) {
    for (const name of NODE_WEB_GLOBAL_NAMES) {
      if (Reflect.has(source, name) && !Reflect.has(target, name)) {
        defineGlobal(target, name, Reflect.get(source, name));
      }
    }
  }

  const subtle = webcrypto.subtle;

  if (!Reflect.has(target, 'SubtleCrypto')) {
    defineGlobal(target, 'SubtleCrypto', subtle.constructor);
  }

  const crypto: unknown = Reflect.get(target, 'crypto');

  if (crypto === undefined) {
    defineGlobal(target, 'crypto', webcrypto);
  } else if (typeof crypto === 'object' && crypto !== null && Reflect.get(crypto, 'subtle') === undefined) {
    defineGlobal(crypto, 'subtle', subtle);
  }
}

function defineGlobal(target: object, name: string, value: unknown): void {
  Object.defineProperty(target, name, {
    configurable: true,
    enumerable: false,
    value,
    writable: true
  });
}
