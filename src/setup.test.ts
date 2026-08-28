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
  drainCollectedUnhandledAsyncErrors,
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

type CapturedHook = HookFunction | undefined;

interface CapturedSetupHooks {
  afterAllCallback(): ReturnType<HookFunction>;
  afterEachCallback(): ReturnType<HookFunction>;
  beforeEachCallback(): ReturnType<HookFunction>;
}

type HookFunction = Parameters<HookRegistrar>[0];

describe('setup', () => {
  afterEach(() => {
    disableAsyncOperationTracking();
  });

  it('should register handlers with the provided hooks', () => {
    const beforeEachRegistrar = vi.fn<HookRegistrar>();
    const afterEachRegistrar = vi.fn<HookRegistrar>();
    const afterAllRegistrar = vi.fn<HookRegistrar>();

    setup({
      afterAll: afterAllRegistrar,
      afterEach: afterEachRegistrar,
      beforeEach: beforeEachRegistrar
    });

    expect(beforeEachRegistrar).toHaveBeenCalledTimes(1);
    expect(beforeEachRegistrar).toHaveBeenCalledWith(expect.any(Function));
    expect(afterEachRegistrar).toHaveBeenCalledTimes(1);
    expect(afterEachRegistrar).toHaveBeenCalledWith(expect.any(Function));
    expect(afterAllRegistrar).toHaveBeenCalledTimes(1);
    expect(afterAllRegistrar).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should reset state and enable tracking via beforeEach, and disable tracking via afterEach', async () => {
    let beforeEachCallback: CapturedHook;
    let afterEachCallback: CapturedHook;

    const beforeEachRegistrar = vi.fn<HookRegistrar>(($function) => {
      beforeEachCallback = $function;
    });
    const afterEachRegistrar = vi.fn<HookRegistrar>(($function) => {
      afterEachCallback = $function;
    });

    setup({
      afterAll: noop,
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
      afterAll: noop,
      afterEach: noop,
      beforeEach: ($function) => {
        beforeEachCallback = $function;
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
    } catch (error_) {
      thrown = error_;
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
    } catch (error) {
      thrown = error;
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

  it('should report an async error even while a consumer handler is registered', async () => {
    const { afterEachCallback, beforeEachCallback } = captureSetupHooks();

    await beforeEachCallback();
    // A registered handler shows the user a Notice; that is not a test asserting the error was expected.
    using _registration = registerAsyncErrorEventHandler(vi.fn());
    const error = new Error('handled by a consumer, yet still unexpected');
    emitAsyncErrorEvent(error);

    const thrown = await captureRejection(afterEachCallback);

    expect(thrown).toBeInstanceOf(AggregateError);
    expect((thrown as AggregateError).message).toContain('during the test');
    expect((thrown as AggregateError).errors).toStrictEqual([error]);
  });

  it('should not report an async error emitted within an ignore context while a handler is registered', async () => {
    const { afterEachCallback, beforeEachCallback } = captureSetupHooks();

    await beforeEachCallback();
    using _registration = registerAsyncErrorEventHandler(vi.fn());
    {
      using _ignore = startAsyncErrorIgnoreContext();
      emitAsyncErrorEvent(new Error('deliberate'));
    }

    await expect(afterEachCallback()).resolves.toBeUndefined();
  });

  it('should report an async error emitted from a timer the test left pending', async () => {
    const { afterEachCallback, beforeEachCallback } = captureSetupHooks();

    await beforeEachCallback();
    const error = new Error('late timer');
    // A pending timer is not a tracked async operation, so only the macrotask drain in afterEach catches it.
    window.setTimeout(() => {
      emitAsyncErrorEvent(error);
    }, 0);

    const thrown = await captureRejection(afterEachCallback);

    expect(thrown).toBeInstanceOf(AggregateError);
    expect((thrown as AggregateError).errors).toStrictEqual([error]);
  });

  it('should report an async error emitted between tests via the next beforeEach', async () => {
    const { afterEachCallback, beforeEachCallback } = captureSetupHooks();

    await beforeEachCallback();
    await afterEachCallback();

    // AfterEach empties the collection window but deliberately leaves it open, so an error emitted in the
    // Gap before the next test is still collected instead of vanishing.
    silenceConsole();
    const error = new Error('between tests');
    emitAsyncErrorEvent(error);

    const thrown = await captureRejection(beforeEachCallback);

    expect(thrown).toBeInstanceOf(AggregateError);
    expect((thrown as AggregateError).message).toContain('after the previous test finished');
    expect((thrown as AggregateError).errors).toStrictEqual([error]);
  });

  it('should report an async error emitted after the last test via afterAll', async () => {
    const { afterAllCallback, afterEachCallback, beforeEachCallback } = captureSetupHooks();

    await beforeEachCallback();
    await afterEachCallback();

    // No next beforeEach will ever run, so afterAll is the only hook left to report this.
    silenceConsole();
    const error = new Error('after the last test');
    emitAsyncErrorEvent(error);

    const thrown = await captureRejection(afterAllCallback);

    expect(thrown).toBeInstanceOf(AggregateError);
    expect((thrown as AggregateError).message).toContain('after the last test finished');
    expect((thrown as AggregateError).errors).toStrictEqual([error]);
  });

  it('should close the collection window via afterAll', async () => {
    const { afterAllCallback, beforeEachCallback } = captureSetupHooks();

    await beforeEachCallback();

    await expect(afterAllCallback()).resolves.toBeUndefined();

    silenceConsole();
    emitAsyncErrorEvent(new Error('after the window closed'));
    expect(drainCollectedUnhandledAsyncErrors()).toStrictEqual([]);
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

async function captureRejection($function: () => ReturnType<HookFunction>): Promise<unknown> {
  let thrown: unknown;
  try {
    await $function();
  } catch (error) {
    thrown = error;
  }
  return thrown;
}

function captureSetupHooks(): CapturedSetupHooks {
  let beforeEachCallback: CapturedHook;
  let afterEachCallback: CapturedHook;
  let afterAllCallback: CapturedHook;

  setup({
    afterAll: ($function) => {
      afterAllCallback = $function;
    },
    afterEach: ($function) => {
      afterEachCallback = $function;
    },
    beforeEach: ($function) => {
      beforeEachCallback = $function;
    }
  });

  assertNonNullable(beforeEachCallback);
  assertNonNullable(afterEachCallback);
  assertNonNullable(afterAllCallback);
  return { afterAllCallback, afterEachCallback, beforeEachCallback };
}
