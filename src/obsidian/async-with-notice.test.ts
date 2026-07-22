// @vitest-environment jsdom

import type { Debugger } from 'debug';
import type { Notice as NoticeOriginal } from 'obsidian';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { TimeoutContext } from '../async.ts';
import type { GenericObject } from '../type-guards.ts';
import type { ValueProvider } from '../value-provider.ts';
import type { PluginNoticeComponent } from './components/plugin-notice-component.ts';

import {
  retryWithTimeout,
  runWithTimeout
} from '../async.ts';
import { getDebugger } from '../debug.ts';
import { noopAsync } from '../function.ts';
import { castTo } from '../object-utils.ts';
import { strictProxy } from '../strict-proxy.ts';
import {
  assertNonNullable,
  ensureNonNullable
} from '../type-guards.ts';
import {
  retryWithTimeoutNotice,
  runWithTimeoutNotice
} from './async-with-notice.ts';
import { t } from './i18n/i18n.ts';

const asyncMock = vi.hoisted(() => {
  const invokePromises: Promise<unknown>[] = [];
  return {
    invokeAsyncSafely: vi.fn((fn: () => unknown) => {
      invokePromises.push(Promise.resolve(fn()));
    }),
    settleInvocations: async (): Promise<void> => {
      await Promise.all(invokePromises);
    }
  };
});

vi.mock('../async.ts', () => ({
  invokeAsyncSafely: asyncMock.invokeAsyncSafely,
  retryWithTimeout: vi.fn(async (options: GenericObject) => {
    if (typeof options['_captureOnTimeout'] === 'function') {
      (options['_captureOnTimeout'] as (fn: unknown) => void)(options['onTimeout']);
    }
    if (typeof options['operationFn'] === 'function') {
      await (options['operationFn'] as (signal: AbortSignal) => Promise<unknown>)(new AbortController().signal);
    }
  }),
  runWithTimeout: vi.fn(async (options: GenericObject) => {
    await noopAsync();
    if (typeof options['_captureOnTimeout'] === 'function') {
      (options['_captureOnTimeout'] as (fn: unknown) => void)(options['onTimeout']);
    }
    if (typeof options['operationFn'] === 'function') {
      return (options['operationFn'] as (signal: AbortSignal) => unknown)(new AbortController().signal);
    }
    return undefined;
  })
}));

vi.mock('../debug.ts', () => ({
  getDebugger: vi.fn(() => vi.fn())
}));

vi.mock('../obsidian/i18n/i18n.ts', () => ({
  t: vi.fn((selectorFn: (translations: GenericObject) => string, _options?: GenericObject) => {
    const translations = {
      obsidianDevUtils: {
        asyncWithNotice: {
          milliseconds: 'milliseconds...',
          operation: 'Operation',
          runningFor: 'Running for',
          terminateOperation: 'You can terminate the operation by clicking the button below.',
          timedOut: 'The operation timed out.'
        },
        buttons: {
          cancel: 'Cancel'
        }
      }
    };
    try {
      return selectorFn(translations);
    } catch {
      return 'mock-translation';
    }
  })
}));

interface CreateFragmentGlobalResult {
  cleanup(): void;
  getLastFragment(): DocumentFragment | null;
}

/**
 * Creates a mock plugin notice component whose showNotice returns a notice that can be hidden.
 *
 * @returns A mock plugin notice component.
 */
function createMockPluginNoticeComponent(): PluginNoticeComponent {
  return strictProxy<PluginNoticeComponent>({
    showNotice: vi.fn(() => strictProxy<NoticeOriginal>({ hide: vi.fn() }))
  });
}

/**
 * Wraps the global createFragment (provided by obsidian-globals) to capture
 * the last created fragment for test assertions.
 *
 * @returns A cleanup function and a getter for the last fragment.
 */
function setupCreateFragmentGlobal(): CreateFragmentGlobalResult {
  let lastFragment: DocumentFragment | null = null;
  // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
  const originalCreateFragment = globalThis.createFragment;

  // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
  globalThis.createFragment = vi.fn((cb?: (f: DocumentFragment) => void): DocumentFragment => {
    const fragment = originalCreateFragment(cb);
    lastFragment = fragment;
    return fragment;
  });

  return {
    cleanup: (): void => {
      // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
      globalThis.createFragment = originalCreateFragment;
    },
    getLastFragment: (): DocumentFragment | null => lastFragment
  };
}

describe('AsyncWithNotice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('retryWithTimeoutNotice', () => {
    it('should call retryWithTimeout with the provided options', async () => {
      const operationFn = vi.fn(async () => {
        await noopAsync();
        return true;
      });
      await retryWithTimeoutNotice({
        operationFn,
        operationName: 'testOp',
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({})
      });
      expect(retryWithTimeout).toHaveBeenCalledTimes(1);
    });

    it('should forward operationFn to retryWithTimeout', async () => {
      const operationFn = vi.fn(async () => {
        await noopAsync();
        return true;
      });
      await retryWithTimeoutNotice({
        operationFn,
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({})
      });
      const callArgs = ensureNonNullable(vi.mocked(retryWithTimeout).mock.calls[0])[0];
      expect(callArgs.operationFn).toBe(operationFn);
    });

    it('should forward operationName to retryWithTimeout', async () => {
      const operationFn = vi.fn(async () => {
        await noopAsync();
        return true;
      });
      await retryWithTimeoutNotice({
        operationFn,
        operationName: 'myOperation',
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({})
      });
      const callArgs = ensureNonNullable(vi.mocked(retryWithTimeout).mock.calls[0])[0];
      expect(callArgs.operationName).toBe('myOperation');
    });

    it('should forward retryOptions to retryWithTimeout', async () => {
      const operationFn = vi.fn(async () => {
        await noopAsync();
        return true;
      });
      const retryOptions = { retryDelayInMilliseconds: 200, timeoutInMilliseconds: 3000 };
      await retryWithTimeoutNotice({
        operationFn,
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
        retryOptions
      });
      const callArgs = ensureNonNullable(vi.mocked(retryWithTimeout).mock.calls[0])[0];
      expect(callArgs.retryOptions).toBe(retryOptions);
    });

    it('should forward stackTrace to retryWithTimeout', async () => {
      const operationFn = vi.fn(async () => {
        await noopAsync();
        return true;
      });
      await retryWithTimeoutNotice({
        operationFn,
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
        stackTrace: 'custom-stack'
      });
      const callArgs = ensureNonNullable(vi.mocked(retryWithTimeout).mock.calls[0])[0];
      expect(callArgs.stackTrace).toBe('custom-stack');
    });

    it('should pass onTimeoutNotice as onTimeout when shouldShowTimeoutNotice is true', async () => {
      let capturedOnTimeout: ((ctx: TimeoutContext) => void) | null = null;
      vi.mocked(retryWithTimeout).mockImplementationOnce(async (options) => {
        await noopAsync();
        capturedOnTimeout = options.onTimeout as (ctx: TimeoutContext) => void;
      });

      await retryWithTimeoutNotice({
        operationFn: async () => {
          await noopAsync();
          return true;
        },
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
        shouldShowTimeoutNotice: true
      });

      expect(capturedOnTimeout).toBeTypeOf('function');
    });

    it('should pass onTimeoutWithoutNotice as onTimeout when shouldShowTimeoutNotice is false', async () => {
      let capturedOnTimeout: ((ctx: TimeoutContext) => void) | null = null;
      vi.mocked(retryWithTimeout).mockImplementationOnce(async (options) => {
        await noopAsync();
        capturedOnTimeout = options.onTimeout as (ctx: TimeoutContext) => void;
      });

      await retryWithTimeoutNotice({
        operationFn: async () => {
          await noopAsync();
          return true;
        },
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
        shouldShowTimeoutNotice: false
      });

      expect(capturedOnTimeout).toBeTypeOf('function');
    });

    it('should pass onTimeoutNotice as onTimeout when shouldShowTimeoutNotice is undefined', async () => {
      let capturedOnTimeoutWithFalse: ((ctx: TimeoutContext) => void) | null = null;
      let capturedOnTimeoutWithUndefined: ((ctx: TimeoutContext) => void) | null = null;

      vi.mocked(retryWithTimeout).mockImplementationOnce(async (options) => {
        await noopAsync();
        capturedOnTimeoutWithFalse = options.onTimeout as (ctx: TimeoutContext) => void;
      });
      await retryWithTimeoutNotice({
        operationFn: async () => {
          await noopAsync();
          return true;
        },
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
        shouldShowTimeoutNotice: false
      });

      vi.mocked(retryWithTimeout).mockImplementationOnce(async (options) => {
        await noopAsync();
        capturedOnTimeoutWithUndefined = options.onTimeout as (ctx: TimeoutContext) => void;
      });
      await retryWithTimeoutNotice({
        operationFn: async () => {
          await noopAsync();
          return true;
        },
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({})
      });

      // Undefined defaults to true, so it must use the notice-showing handler, not the no-notice one used for false.
      expect(capturedOnTimeoutWithUndefined).not.toBe(capturedOnTimeoutWithFalse);
    });

    it('should use a different onTimeout for true vs false shouldShowTimeoutNotice', async () => {
      let capturedOnTimeoutTrue: ((ctx: TimeoutContext) => void) | null = null;
      let capturedOnTimeoutFalse: ((ctx: TimeoutContext) => void) | null = null;

      vi.mocked(retryWithTimeout).mockImplementationOnce(async (options) => {
        await noopAsync();
        capturedOnTimeoutTrue = options.onTimeout as (ctx: TimeoutContext) => void;
      });
      await retryWithTimeoutNotice({
        operationFn: async () => {
          await noopAsync();
          return true;
        },
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
        shouldShowTimeoutNotice: true
      });

      vi.mocked(retryWithTimeout).mockImplementationOnce(async (options) => {
        await noopAsync();
        capturedOnTimeoutFalse = options.onTimeout as (ctx: TimeoutContext) => void;
      });
      await retryWithTimeoutNotice({
        operationFn: async () => {
          await noopAsync();
          return true;
        },
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
        shouldShowTimeoutNotice: false
      });

      expect(capturedOnTimeoutTrue).not.toBe(capturedOnTimeoutFalse);
    });

    it('should use onTimeoutWithoutNotice when no pluginNoticeComponent is supplied, even when notices are enabled', async () => {
      let capturedWithoutComponent: ((ctx: TimeoutContext) => void) | null = null;
      let capturedSilent: ((ctx: TimeoutContext) => void) | null = null;

      vi.mocked(retryWithTimeout).mockImplementationOnce(async (options) => {
        await noopAsync();
        capturedWithoutComponent = options.onTimeout as (ctx: TimeoutContext) => void;
      });
      await retryWithTimeoutNotice({
        operationFn: async () => {
          await noopAsync();
          return true;
        },
        pluginNoticeComponent: null,
        shouldShowTimeoutNotice: true
      });

      vi.mocked(retryWithTimeout).mockImplementationOnce(async (options) => {
        await noopAsync();
        capturedSilent = options.onTimeout as (ctx: TimeoutContext) => void;
      });
      await retryWithTimeoutNotice({
        operationFn: async () => {
          await noopAsync();
          return true;
        },
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
        shouldShowTimeoutNotice: false
      });

      // No component means the silent handler is used, identical to the explicit no-notice path, so the
      // Timeout is only logged and showNotice is never accessed.
      expect(capturedWithoutComponent).toBe(capturedSilent);
    });
  });

  describe('runWithTimeoutNotice', () => {
    it('should call runWithTimeout with the provided options', async () => {
      const operationFn = vi.fn(async () => {
        await noopAsync();
        return 42;
      });
      await runWithTimeoutNotice({
        operationFn,
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
        timeoutInMilliseconds: 5000
      });
      expect(runWithTimeout).toHaveBeenCalledTimes(1);
    });

    it('should return the result from the operation', async () => {
      const result = await runWithTimeoutNotice({
        operationFn: async () => {
          await noopAsync();
          return 'test-result';
        },
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
        timeoutInMilliseconds: 5000
      });
      expect(result).toBe('test-result');
    });

    it('should return the result for synchronous operationFn', async () => {
      const result = await runWithTimeoutNotice({
        operationFn: () => 123,
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
        timeoutInMilliseconds: 5000
      });
      expect(result).toBe(123);
    });

    it('should forward operationFn to runWithTimeout', async () => {
      const operationFn = vi.fn(async () => {
        await noopAsync();
        return 'value';
      });
      await runWithTimeoutNotice({
        operationFn,
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
        timeoutInMilliseconds: 5000
      });
      const callArgs = ensureNonNullable(vi.mocked(runWithTimeout).mock.calls[0])[0];
      expect(callArgs.operationFn).toBe(operationFn);
    });

    it('should forward operationName to runWithTimeout', async () => {
      await runWithTimeoutNotice({
        operationFn: async () => {
          await noopAsync();
          return 'value';
        },
        operationName: 'myOp',
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
        timeoutInMilliseconds: 5000
      });
      const callArgs = ensureNonNullable(vi.mocked(runWithTimeout).mock.calls[0])[0];
      expect(callArgs.operationName).toBe('myOp');
    });

    it('should forward timeoutInMilliseconds to runWithTimeout', async () => {
      await runWithTimeoutNotice({
        operationFn: async () => {
          await noopAsync();
          return 'value';
        },
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
        timeoutInMilliseconds: 3000
      });
      const callArgs = ensureNonNullable(vi.mocked(runWithTimeout).mock.calls[0])[0];
      expect(callArgs.timeoutInMilliseconds).toBe(3000);
    });

    it('should forward stackTrace to runWithTimeout', async () => {
      await runWithTimeoutNotice({
        operationFn: async () => {
          await noopAsync();
          return 'value';
        },
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
        stackTrace: 'my-stack',
        timeoutInMilliseconds: 5000
      });
      const callArgs = ensureNonNullable(vi.mocked(runWithTimeout).mock.calls[0])[0];
      expect(callArgs.stackTrace).toBe('my-stack');
    });

    it('should forward context to runWithTimeout', async () => {
      const context = { some: 'data' };
      await runWithTimeoutNotice({
        context,
        operationFn: async () => {
          await noopAsync();
          return 'value';
        },
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
        timeoutInMilliseconds: 5000
      });
      const callArgs = ensureNonNullable(vi.mocked(runWithTimeout).mock.calls[0])[0];
      expect(callArgs.context).toBe(context);
    });

    it('should pass onTimeoutNotice as onTimeout when shouldShowTimeoutNotice is true', async () => {
      const onTimeout = await new Promise<(ctx: TimeoutContext) => void>((resolve) => {
        vi.mocked(runWithTimeout).mockImplementationOnce(async (options) => {
          await noopAsync();
          resolve(options.onTimeout as (ctx: TimeoutContext) => void);
          return undefined;
        });
        runWithTimeoutNotice({
          operationFn: async () => {
            await noopAsync();
            return 'value';
          },
          pluginNoticeComponent: createMockPluginNoticeComponent(),
          shouldShowTimeoutNotice: true,
          timeoutInMilliseconds: 5000
        }).catch(() => {
          // Ignore
        });
      });

      expect(onTimeout).toBeTypeOf('function');

      const { cleanup } = setupCreateFragmentGlobal();
      onTimeout({
        duration: 5000,
        onOperationCompleted: vi.fn(),
        operationName: 'runOp',
        terminateOperation: vi.fn()
      });
      cleanup();
    });

    it('should pass onTimeoutWithoutNotice as onTimeout when shouldShowTimeoutNotice is false', async () => {
      let capturedOnTimeout: ((ctx: TimeoutContext) => void) | null = null;
      vi.mocked(runWithTimeout).mockImplementationOnce(async (options) => {
        await noopAsync();
        capturedOnTimeout = options.onTimeout as (ctx: TimeoutContext) => void;
        return undefined;
      });

      await runWithTimeoutNotice({
        operationFn: async () => {
          await noopAsync();
          return 'value';
        },
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
        shouldShowTimeoutNotice: false,
        timeoutInMilliseconds: 5000
      });

      expect(capturedOnTimeout).toBeTypeOf('function');
    });

    it('should use different onTimeout functions for true vs false', async () => {
      let capturedOnTimeoutTrue: ((ctx: TimeoutContext) => void) | null = null;
      let capturedOnTimeoutFalse: ((ctx: TimeoutContext) => void) | null = null;

      vi.mocked(runWithTimeout).mockImplementationOnce(async (options) => {
        await noopAsync();
        capturedOnTimeoutTrue = options.onTimeout as (ctx: TimeoutContext) => void;
        return undefined;
      });
      await runWithTimeoutNotice({
        operationFn: async () => {
          await noopAsync();
          return 'value';
        },
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
        shouldShowTimeoutNotice: true,
        timeoutInMilliseconds: 5000
      });

      vi.mocked(runWithTimeout).mockImplementationOnce(async (options) => {
        await noopAsync();
        capturedOnTimeoutFalse = options.onTimeout as (ctx: TimeoutContext) => void;
        return undefined;
      });
      await runWithTimeoutNotice({
        operationFn: async () => {
          await noopAsync();
          return 'value';
        },
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
        shouldShowTimeoutNotice: false,
        timeoutInMilliseconds: 5000
      });

      expect(capturedOnTimeoutTrue).not.toBe(capturedOnTimeoutFalse);
    });

    it('should pass onTimeoutNotice as onTimeout when shouldShowTimeoutNotice is undefined', async () => {
      let capturedOnTimeoutWithFalse: ((ctx: TimeoutContext) => void) | null = null;
      let capturedOnTimeoutWithUndefined: ((ctx: TimeoutContext) => void) | null = null;

      vi.mocked(runWithTimeout).mockImplementationOnce(async (options) => {
        await noopAsync();
        capturedOnTimeoutWithFalse = options.onTimeout as (ctx: TimeoutContext) => void;
        return undefined;
      });
      await runWithTimeoutNotice({
        operationFn: async () => {
          await noopAsync();
          return 'value';
        },
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
        shouldShowTimeoutNotice: false,
        timeoutInMilliseconds: 5000
      });

      vi.mocked(runWithTimeout).mockImplementationOnce(async (options) => {
        await noopAsync();
        capturedOnTimeoutWithUndefined = options.onTimeout as (ctx: TimeoutContext) => void;
        return undefined;
      });
      await runWithTimeoutNotice({
        operationFn: async () => {
          await noopAsync();
          return 'value';
        },
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
        timeoutInMilliseconds: 5000
      });

      // Undefined defaults to true, so it must use the notice-showing handler, not the no-notice one used for false.
      expect(capturedOnTimeoutWithUndefined).not.toBe(capturedOnTimeoutWithFalse);
    });

    it('should use onTimeoutWithoutNotice when no pluginNoticeComponent is supplied, even when notices are enabled', async () => {
      let capturedWithoutComponent: ((ctx: TimeoutContext) => void) | null = null;
      let capturedSilent: ((ctx: TimeoutContext) => void) | null = null;

      vi.mocked(runWithTimeout).mockImplementationOnce(async (options) => {
        await noopAsync();
        capturedWithoutComponent = options.onTimeout as (ctx: TimeoutContext) => void;
        return undefined;
      });
      await runWithTimeoutNotice({
        operationFn: async () => {
          await noopAsync();
          return 'value';
        },
        pluginNoticeComponent: null,
        shouldShowTimeoutNotice: true,
        timeoutInMilliseconds: 5000
      });

      vi.mocked(runWithTimeout).mockImplementationOnce(async (options) => {
        await noopAsync();
        capturedSilent = options.onTimeout as (ctx: TimeoutContext) => void;
        return undefined;
      });
      await runWithTimeoutNotice({
        operationFn: async () => {
          await noopAsync();
          return 'value';
        },
        pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
        shouldShowTimeoutNotice: false,
        timeoutInMilliseconds: 5000
      });

      // No component means the silent handler is used, identical to the explicit no-notice path, so the
      // Timeout is only logged and showNotice is never accessed.
      expect(capturedWithoutComponent).toBe(capturedSilent);
    });
  });

  describe('onTimeoutNotice (tested indirectly)', () => {
    function captureOnTimeoutNotice(): Promise<(ctx: TimeoutContext) => void> {
      return new Promise((resolve) => {
        vi.mocked(retryWithTimeout).mockImplementationOnce(async (options) => {
          await noopAsync();
          resolve(options.onTimeout as (ctx: TimeoutContext) => void);
        });
        retryWithTimeoutNotice({
          operationFn: async () => {
            await noopAsync();
            return true;
          },
          pluginNoticeComponent: createMockPluginNoticeComponent(),
          shouldShowTimeoutNotice: true
        }).catch(() => {
          // Ignore
        });
      });
    }

    function createMockTimeoutContext(overrides?: Partial<TimeoutContext>): TimeoutContext {
      return {
        duration: 5000,
        onOperationCompleted: vi.fn(),
        operationName: 'testOperation',
        terminateOperation: vi.fn(),
        ...overrides
      };
    }

    it('should create a Notice when timeout fires with operationName', async () => {
      const onTimeout = await captureOnTimeoutNotice();
      const ctx = createMockTimeoutContext({ operationName: 'myOp' });

      const { cleanup } = setupCreateFragmentGlobal();

      onTimeout(ctx);

      // Verify that t() was called for the operation translation
      expect(t).toHaveBeenCalled();

      cleanup();
    });

    it('should create a Notice when timeout fires without operationName', async () => {
      const onTimeout = await captureOnTimeoutNotice();
      const ctx = createMockTimeoutContext({ operationName: '' });

      const { cleanup } = setupCreateFragmentGlobal();

      onTimeout(ctx);

      // The fragment should NOT contain 'Operation' text for empty operationName
      // Because the `if (ctx.operationName)` branch is skipped
      expect(t).toHaveBeenCalled();

      cleanup();
    });

    it('should call terminateOperation when cancel button is clicked', async () => {
      const onTimeout = await captureOnTimeoutNotice();
      const terminateOperation = vi.fn();
      const ctx = createMockTimeoutContext({ terminateOperation });

      const { cleanup, getLastFragment } = setupCreateFragmentGlobal();

      onTimeout(ctx);

      const fragment = getLastFragment();
      expect(fragment).not.toBeNull();
      const button = fragment?.querySelector('button');
      expect(button).not.toBeNull();
      button?.click();

      expect(terminateOperation).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('should clear interval and hide notice when operation completes', async () => {
      const onTimeout = await captureOnTimeoutNotice();
      const onOperationCompletedCallbacks: (() => void)[] = [];
      const onOperationCompletedMock = vi.fn((cb: () => void) => {
        onOperationCompletedCallbacks.push(cb);
      });
      const ctx = createMockTimeoutContext({
        onOperationCompleted: onOperationCompletedMock
      });

      const { cleanup } = setupCreateFragmentGlobal();
      // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
      vi.spyOn(globalThis, 'clearInterval');

      onTimeout(ctx);

      expect(onOperationCompletedMock).toHaveBeenCalledTimes(1);
      expect(onOperationCompletedCallbacks.length).toBe(1);

      // Simulate the operation completing
      const callback = onOperationCompletedCallbacks[0];
      assertNonNullable(callback);
      callback();

      // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
      expect(vi.mocked(globalThis.clearInterval)).toHaveBeenCalled();
      // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
      vi.mocked(globalThis.clearInterval).mockRestore();
      cleanup();
    });

    it('should set up an interval to update running time', async () => {
      const onTimeout = await captureOnTimeoutNotice();
      const ctx = createMockTimeoutContext();

      const { cleanup } = setupCreateFragmentGlobal();
      // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
      vi.spyOn(globalThis, 'setInterval');

      onTimeout(ctx);

      // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
      expect(vi.mocked(globalThis.setInterval)).toHaveBeenCalledWith(expect.any(Function), 1000);
      // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
      vi.mocked(globalThis.setInterval).mockRestore();
      cleanup();
    });

    it('should clear interval when cancel button is clicked', async () => {
      const onTimeout = await captureOnTimeoutNotice();
      const ctx = createMockTimeoutContext();

      const { cleanup, getLastFragment } = setupCreateFragmentGlobal();
      // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
      vi.spyOn(globalThis, 'clearInterval');

      onTimeout(ctx);

      const fragment = getLastFragment();
      const button = fragment?.querySelector('button');
      expect(button).not.toBeNull();
      button?.click();

      // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
      expect(vi.mocked(globalThis.clearInterval)).toHaveBeenCalled();

      // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
      vi.mocked(globalThis.clearInterval).mockRestore();
      cleanup();
    });

    it('should create a span element for running time', async () => {
      const onTimeout = await captureOnTimeoutNotice();
      const ctx = createMockTimeoutContext();

      const { cleanup, getLastFragment } = setupCreateFragmentGlobal();

      onTimeout(ctx);

      const fragment = getLastFragment();
      const span = fragment?.querySelector('span');
      expect(span).not.toBeNull();
      // The span should have the running time text content
      expect(span?.textContent).toBeTruthy();

      cleanup();
    });

    it('should create br elements for line breaks', async () => {
      const onTimeout = await captureOnTimeoutNotice();
      const ctx = createMockTimeoutContext({ operationName: 'someOp' });

      const { cleanup, getLastFragment } = setupCreateFragmentGlobal();

      onTimeout(ctx);

      const fragment = getLastFragment();
      const brElements = fragment?.querySelectorAll('br');
      // With operationName: br after name, br after timedOut, br after milliseconds, br after terminateOperation
      expect(brElements?.length).toBeGreaterThanOrEqual(4);

      cleanup();
    });

    it('should have cancel button with correct text', async () => {
      const onTimeout = await captureOnTimeoutNotice();
      const ctx = createMockTimeoutContext();

      const { cleanup, getLastFragment } = setupCreateFragmentGlobal();

      onTimeout(ctx);

      const fragment = getLastFragment();
      const button = fragment?.querySelector('button');
      expect(button).not.toBeNull();
      expect(button?.textContent).toBe('Cancel');

      cleanup();
    });
  });

  describe('onTimeoutWithoutNotice (tested indirectly)', () => {
    function captureOnTimeoutWithoutNotice(): Promise<(ctx: TimeoutContext) => void> {
      return new Promise((resolve) => {
        vi.mocked(retryWithTimeout).mockImplementationOnce(async (options) => {
          await noopAsync();
          resolve(options.onTimeout as (ctx: TimeoutContext) => void);
        });
        retryWithTimeoutNotice({
          operationFn: async () => {
            await noopAsync();
            return true;
          },
          pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
          shouldShowTimeoutNotice: false
        }).catch(() => {
          // Ignore
        });
      });
    }

    function createMockTimeoutContext(overrides?: Partial<TimeoutContext>): TimeoutContext {
      return {
        duration: 5000,
        onOperationCompleted: vi.fn(),
        operationName: 'testOperation',
        terminateOperation: vi.fn(),
        ...overrides
      };
    }

    it('should register a completion handler', async () => {
      const onTimeout = await captureOnTimeoutWithoutNotice();
      const onOperationCompletedMock = vi.fn();
      const ctx = createMockTimeoutContext({
        onOperationCompleted: onOperationCompletedMock
      });

      onTimeout(ctx);

      expect(onOperationCompletedMock).toHaveBeenCalledTimes(1);
      expect(onOperationCompletedMock).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should call getDebugger when operation completes', async () => {
      const onTimeout = await captureOnTimeoutWithoutNotice();
      const onOperationCompletedCallbacks: (() => void)[] = [];
      const ctx = createMockTimeoutContext({
        onOperationCompleted: vi.fn((cb: () => void) => {
          onOperationCompletedCallbacks.push(cb);
        })
      });

      onTimeout(ctx);

      expect(onOperationCompletedCallbacks.length).toBe(1);
      const callback = onOperationCompletedCallbacks[0];
      assertNonNullable(callback);
      callback();

      expect(getDebugger).toHaveBeenCalledWith('AsyncWithNotice:onTimeoutWithoutNotice');
    });

    it('should log debug info with operation name and total duration when operation completes', async () => {
      const onTimeout = await captureOnTimeoutWithoutNotice();
      const mockDebugFn = vi.fn();
      vi.mocked(getDebugger).mockReturnValue(castTo<Debugger>(mockDebugFn));

      const onOperationCompletedCallbacks: (() => void)[] = [];
      const ctx = createMockTimeoutContext({
        onOperationCompleted: vi.fn((cb: () => void) => {
          onOperationCompletedCallbacks.push(cb);
        }),
        operationName: 'debugOp'
      });

      onTimeout(ctx);

      const callback = onOperationCompletedCallbacks[0];
      assertNonNullable(callback);
      callback();

      expect(mockDebugFn).toHaveBeenCalledWith(
        'Operation completed after timeout',
        expect.objectContaining({
          operationName: 'debugOp',
          totalDuration: expect.any(Number) as number
        })
      );
    });

    it('should not call terminateOperation', async () => {
      const onTimeout = await captureOnTimeoutWithoutNotice();
      const terminateOperationMock = vi.fn();
      const ctx = createMockTimeoutContext({
        terminateOperation: terminateOperationMock
      });

      onTimeout(ctx);

      expect(terminateOperationMock).not.toHaveBeenCalled();
    });
  });

  describe('onTimeoutNotice with custom content', () => {
    function captureRunOnTimeout(content: ValueProvider<DocumentFragment | string>, pluginNoticeComponent: PluginNoticeComponent): Promise<(ctx: TimeoutContext) => void> {
      return new Promise((resolve) => {
        vi.mocked(runWithTimeout).mockImplementationOnce(async (options) => {
          await noopAsync();
          resolve(options.onTimeout as (ctx: TimeoutContext) => void);
          return undefined;
        });
        runWithTimeoutNotice({
          content,
          operationFn: async () => {
            await noopAsync();
            return 'value';
          },
          pluginNoticeComponent,
          timeoutInMilliseconds: 5000
        }).catch(() => {
          // Ignore
        });
      });
    }

    function createContentTimeoutContext(onOperationCompleted: (callback: () => void) => void = vi.fn()): TimeoutContext {
      return {
        duration: 5000,
        onOperationCompleted,
        operationName: 'contentOp',
        terminateOperation: vi.fn()
      };
    }

    it('shows a permanent notice with the resolved custom content and hides it on completion', async () => {
      const hideMock = vi.fn();
      const showNoticeMock = vi.fn(() => strictProxy<NoticeOriginal>({ hide: hideMock }));
      const pluginNoticeComponent = strictProxy<PluginNoticeComponent>({ showNotice: showNoticeMock });

      const onTimeout = await captureRunOnTimeout(() => Promise.resolve('custom progress message'), pluginNoticeComponent);
      let completedCallback: (() => void) | undefined;
      onTimeout(createContentTimeoutContext((callback) => {
        completedCallback = callback;
      }));
      await asyncMock.settleInvocations();

      expect(showNoticeMock).toHaveBeenCalledTimes(1);
      expect(showNoticeMock).toHaveBeenCalledWith('custom progress message', { isPermanent: true });

      assertNonNullable(completedCallback);
      completedCallback();
      expect(hideMock).toHaveBeenCalledTimes(1);
    });

    it('accepts a direct (non-function) content value', async () => {
      const showNoticeMock = vi.fn(() => strictProxy<NoticeOriginal>({ hide: vi.fn() }));
      const pluginNoticeComponent = strictProxy<PluginNoticeComponent>({ showNotice: showNoticeMock });

      const onTimeout = await captureRunOnTimeout('direct message', pluginNoticeComponent);
      onTimeout(createContentTimeoutContext());
      await asyncMock.settleInvocations();

      expect(showNoticeMock).toHaveBeenCalledWith('direct message', { isPermanent: true });
    });

    it('does not show the notice when the operation completes before the content resolves', async () => {
      const showNoticeMock = vi.fn(() => strictProxy<NoticeOriginal>({ hide: vi.fn() }));
      const pluginNoticeComponent = strictProxy<PluginNoticeComponent>({ showNotice: showNoticeMock });

      const onTimeout = await captureRunOnTimeout(() => Promise.resolve('late message'), pluginNoticeComponent);
      let completedCallback: (() => void) | undefined;
      onTimeout(createContentTimeoutContext((callback) => {
        completedCallback = callback;
      }));

      // Complete the operation before the content promise settles.
      assertNonNullable(completedCallback);
      completedCallback();
      await asyncMock.settleInvocations();

      expect(showNoticeMock).not.toHaveBeenCalled();
    });
  });
});
