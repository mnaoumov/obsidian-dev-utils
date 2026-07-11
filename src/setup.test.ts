import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { HookRegistrar } from './setup.ts';

import {
  disableAsyncOperationTracking,
  invokeAsyncSafely,
  waitForAllAsyncOperations
} from './async.ts';
import {
  emitAsyncErrorEvent,
  registerAsyncErrorEventHandler,
  startAsyncErrorIgnoreContext
} from './error.ts';
import {
  noop,
  noopAsync
} from './function.ts';
import { Library } from './library.ts';
import { getObsidianDevUtilsState } from './obsidian-dev-utils-state.ts';
import {
  restoreConsole,
  setup,
  silenceConsole
} from './setup.ts';
import { strictProxy } from './strict-proxy.ts';
import { assertNonNullable } from './type-guards.ts';

type CapturedHook = HookFn | undefined;

interface CapturedSetupHooks {
  afterEachCallback(): ReturnType<HookFn>;
  beforeEachCallback(): ReturnType<HookFn>;
}

type HookFn = Parameters<HookRegistrar>[0];

describe('setup', () => {
  afterEach(() => {
    disableAsyncOperationTracking();
  });

  it('should register handlers with the provided hooks', () => {
    const beforeEachRegistrar = vi.fn<HookRegistrar>();
    const afterEachRegistrar = vi.fn<HookRegistrar>();

    setup({
      afterEach: afterEachRegistrar,
      beforeEach: beforeEachRegistrar
    });

    expect(beforeEachRegistrar).toHaveBeenCalledTimes(1);
    expect(beforeEachRegistrar).toHaveBeenCalledWith(expect.any(Function));
    expect(afterEachRegistrar).toHaveBeenCalledTimes(1);
    expect(afterEachRegistrar).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should reset state and enable tracking via beforeEach, and disable tracking via afterEach', async () => {
    let beforeEachCallback: CapturedHook;
    let afterEachCallback: CapturedHook;

    const beforeEachRegistrar = vi.fn<HookRegistrar>((fn) => {
      beforeEachCallback = fn;
    });
    const afterEachRegistrar = vi.fn<HookRegistrar>((fn) => {
      afterEachCallback = fn;
    });

    setup({
      afterEach: afterEachRegistrar,
      beforeEach: beforeEachRegistrar
    });

    expect(beforeEachCallback).toBeDefined();
    expect(afterEachCallback).toBeDefined();

    const before = getObsidianDevUtilsState('setup-test-key', 'a');
    before.value = 'mutated';
    Library.init({ cssClassScope: 'mutated-scope', debugPrefixNamespace: '', shouldPrintStackTrace: false });

    await beforeEachCallback?.();

    const after = getObsidianDevUtilsState('setup-test-key', 'b');
    expect(after).not.toBe(before);
    expect(after.value).toBe('b');
    expect(Library.cssClassScope).toBe('');

    await expect(waitForAllAsyncOperations()).resolves.toBeUndefined();

    await afterEachCallback?.();
    await expect(waitForAllAsyncOperations()).rejects.toThrow('Async operation tracking is not enabled');
  });

  it('should clear localStorage via beforeEach, and tolerate localStorage being absent', async () => {
    let beforeEachCallback: CapturedHook;

    setup({
      afterEach: noop,
      beforeEach: (fn) => {
        beforeEachCallback = fn;
      }
    });
    assertNonNullable(beforeEachCallback);

    const store = new Map<string, string>();
    const fakeStorage = strictProxy<Storage>({
      clear: () => {
        store.clear();
      },
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => {
        store.set(key, value);
      }
    });

    // Present: beforeEach clears whatever a previous test left behind.
    vi.stubGlobal('localStorage', fakeStorage);
    fakeStorage.setItem('leftover', 'stale');
    await beforeEachCallback();
    expect(fakeStorage.getItem('leftover')).toBeNull();

    // Absent: clearing is a no-op that does not throw.
    vi.stubGlobal('localStorage', undefined);
    expect(beforeEachCallback).not.toThrow();

    vi.unstubAllGlobals();
  });

  it('should fail via afterEach with an AggregateError when an unhandled async error is emitted', async () => {
    const { afterEachCallback, beforeEachCallback } = captureSetupHooks();

    await beforeEachCallback();
    const error = new Error('boom');
    emitAsyncErrorEvent(error);

    let thrown: unknown;
    try {
      await afterEachCallback();
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(AggregateError);
    expect((thrown as AggregateError).message).toContain('1 unhandled async error');
    expect((thrown as AggregateError).errors).toStrictEqual([error]);
  });

  it('should drain fire-and-forget rejections before reporting them via afterEach', async () => {
    const { afterEachCallback, beforeEachCallback } = captureSetupHooks();

    await beforeEachCallback();
    // Scheduled but deliberately not awaited — the afterEach harness must drain it so it rejects first.
    invokeAsyncSafely(async () => {
      await noopAsync();
      throw new Error('fire-and-forget');
    });

    let thrown: unknown;
    try {
      await afterEachCallback();
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(AggregateError);
    expect((thrown as AggregateError).errors).toHaveLength(1);
  });

  it('should not report a fire-and-forget rejection scheduled within an ignore context', async () => {
    const { afterEachCallback, beforeEachCallback } = captureSetupHooks();

    await beforeEachCallback();
    {
      using _ignore = startAsyncErrorIgnoreContext();
      invokeAsyncSafely(() => Promise.reject(new Error('ignored fire-and-forget')));
    }

    await expect(afterEachCallback()).resolves.toBeUndefined();
  });

  it('should not report an async error consumed by a registered handler', async () => {
    const { afterEachCallback, beforeEachCallback } = captureSetupHooks();

    await beforeEachCallback();
    using _registration = registerAsyncErrorEventHandler(vi.fn());
    emitAsyncErrorEvent(new Error('handled'));

    await expect(afterEachCallback()).resolves.toBeUndefined();
  });

  it('should tolerate a test that disabled async-operation tracking itself', async () => {
    const { afterEachCallback, beforeEachCallback } = captureSetupHooks();

    await beforeEachCallback();
    disableAsyncOperationTracking();

    await expect(afterEachCallback()).resolves.toBeUndefined();
  });
});

describe('silenceConsole / restoreConsole', () => {
  afterEach(() => {
    restoreConsole();
  });

  it('should replace all console methods with noop and restore the originals', () => {
    restoreConsole();

    // Read console methods via descriptors (bare `console`) to avoid `no-console` member-access lint errors.
    const originalLogDescriptor = Object.getOwnPropertyDescriptor(console, 'log');
    const originalInfoDescriptor = Object.getOwnPropertyDescriptor(console, 'info');
    expect(originalLogDescriptor?.value).not.toBe(noop);
    expect(originalInfoDescriptor?.value).not.toBe(noop);

    silenceConsole();

    for (const methodName of ['assert', 'debug', 'dir', 'error', 'info', 'log', 'trace', 'warn'] as const) {
      expect(Object.getOwnPropertyDescriptor(console, methodName)?.value).toBe(noop);
    }

    restoreConsole();

    expect(Object.getOwnPropertyDescriptor(console, 'log')?.value).toBe(originalLogDescriptor?.value);
    expect(Object.getOwnPropertyDescriptor(console, 'info')?.value).toBe(originalInfoDescriptor?.value);
  });
});

function captureSetupHooks(): CapturedSetupHooks {
  let beforeEachCallback: CapturedHook;
  let afterEachCallback: CapturedHook;

  setup({
    afterEach: (fn) => {
      afterEachCallback = fn;
    },
    beforeEach: (fn) => {
      beforeEachCallback = fn;
    }
  });

  assertNonNullable(beforeEachCallback);
  assertNonNullable(afterEachCallback);
  return { afterEachCallback, beforeEachCallback };
}
