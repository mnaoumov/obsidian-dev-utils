// @vitest-environment jsdom

import type { MockInstance } from 'vitest';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { TimeoutContext } from '../../src/Async.ts';

import {
  retryWithTimeout,
  runWithTimeout
} from '../../src/Async.ts';
import { getDebugger } from '../../src/Debug.ts';
import { castTo } from '../../src/ObjectUtils.ts';
import {
  retryWithTimeoutNotice,
  runWithTimeoutNotice
} from '../../src/obsidian/AsyncWithNotice.ts';
import { t } from '../../src/obsidian/i18n/i18n.ts';
import { assertNonNullable } from '../../src/TypeGuards.ts';

vi.mock('../../src/Async.ts', () => ({
  retryWithTimeout: vi.fn(async (options: Record<string, unknown>) => {
    if (typeof options['_captureOnTimeout'] === 'function') {
      (options['_captureOnTimeout'] as (fn: unknown) => void)(options['onTimeout']);
    }
    if (typeof options['operationFn'] === 'function') {
      await (options['operationFn'] as (signal: AbortSignal) => Promise<unknown>)(new AbortController().signal);
    }
  }),
  runWithTimeout: vi.fn(async (options: Record<string, unknown>) => {
    if (typeof options['_captureOnTimeout'] === 'function') {
      (options['_captureOnTimeout'] as (fn: unknown) => void)(options['onTimeout']);
    }
    if (typeof options['operationFn'] === 'function') {
      return (options['operationFn'] as (signal: AbortSignal) => unknown)(new AbortController().signal);
    }
    return undefined;
  })
}));

vi.mock('../../src/Debug.ts', () => ({
  getDebugger: vi.fn(() => vi.fn())
}));

vi.mock('../../src/obsidian/i18n/i18n.ts', () => ({
  t: vi.fn((selectorFn: (translations: Record<string, unknown>) => string, _options?: Record<string, unknown>) => {
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

/**
 * Adds Obsidian-specific DOM extension methods (appendText, createEl, createSpan)
 * to a DocumentFragment so it can be used with Obsidian's createFragment API.
 */
function addObsidianDomExtensions(fragment: DocumentFragment): DocumentFragment {
  const extendedFragment = fragment as {
    appendText(text: string): void;
    createEl(tag: string, options?: { text?: string }): HTMLElement;
    createSpan(): HTMLSpanElement;
  } & DocumentFragment;

  extendedFragment.appendText = function appendText(text: string): void {
    this.appendChild(document.createTextNode(text));
  };

  extendedFragment.createEl = function createEl(tag: string, options?: { text?: string }): HTMLElement {
    const el = document.createElement(tag);
    if (options?.text) {
      el.textContent = options.text;
    }
    this.appendChild(el);
    return el;
  };

  extendedFragment.createSpan = function createSpan(): HTMLSpanElement {
    const span = document.createElement('span');
    this.appendChild(span);
    return span;
  };

  return extendedFragment;
}

/**
 * Sets up the global createFragment function that Obsidian provides,
 * with the necessary DOM extension methods on the fragment.
 *
 * @returns A cleanup function to remove the global.
 */
function setupCreateFragmentGlobal(): { cleanup: () => void; getLastFragment: () => DocumentFragment | null } {
  let lastFragment: DocumentFragment | null = null;

  globalThis.createFragment = (cb?: (f: DocumentFragment) => void): DocumentFragment => {
    const fragment = addObsidianDomExtensions(document.createDocumentFragment());
    cb?.(fragment);
    lastFragment = fragment;
    return fragment;
  };

  return {
    cleanup: (): void => {
      delete (globalThis as Partial<{ createFragment: unknown }>).createFragment;
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
      const operationFn = vi.fn(async () => true);
      await retryWithTimeoutNotice({
        operationFn,
        operationName: 'testOp'
      });
      expect(retryWithTimeout).toHaveBeenCalledTimes(1);
    });

    it('should forward operationFn to retryWithTimeout', async () => {
      const operationFn = vi.fn(async () => true);
      await retryWithTimeoutNotice({ operationFn });
      const callArgs = castTo<MockInstance>(retryWithTimeout).mock.calls[0]?.[0] as Record<string, unknown>;
      expect(callArgs['operationFn']).toBe(operationFn);
    });

    it('should forward operationName to retryWithTimeout', async () => {
      const operationFn = vi.fn(async () => true);
      await retryWithTimeoutNotice({
        operationFn,
        operationName: 'myOperation'
      });
      const callArgs = castTo<MockInstance>(retryWithTimeout).mock.calls[0]?.[0] as Record<string, unknown>;
      expect(callArgs['operationName']).toBe('myOperation');
    });

    it('should forward retryOptions to retryWithTimeout', async () => {
      const operationFn = vi.fn(async () => true);
      const retryOptions = { retryDelayInMilliseconds: 200, timeoutInMilliseconds: 3000 };
      await retryWithTimeoutNotice({
        operationFn,
        retryOptions
      });
      const callArgs = castTo<MockInstance>(retryWithTimeout).mock.calls[0]?.[0] as Record<string, unknown>;
      expect(callArgs['retryOptions']).toBe(retryOptions);
    });

    it('should forward stackTrace to retryWithTimeout', async () => {
      const operationFn = vi.fn(async () => true);
      await retryWithTimeoutNotice({
        operationFn,
        stackTrace: 'custom-stack'
      });
      const callArgs = castTo<MockInstance>(retryWithTimeout).mock.calls[0]?.[0] as Record<string, unknown>;
      expect(callArgs['stackTrace']).toBe('custom-stack');
    });

    it('should pass onTimeoutNotice as onTimeout when shouldShowTimeoutNotice is true', async () => {
      let capturedOnTimeout: ((ctx: TimeoutContext) => void) | null = null;
      castTo<MockInstance>(retryWithTimeout).mockImplementationOnce(async (options: Record<string, unknown>) => {
        capturedOnTimeout = options['onTimeout'] as (ctx: TimeoutContext) => void;
      });

      await retryWithTimeoutNotice({
        operationFn: async () => true,
        shouldShowTimeoutNotice: true
      });

      expect(capturedOnTimeout).toBeTypeOf('function');
    });

    it('should pass onTimeoutWithoutNotice as onTimeout when shouldShowTimeoutNotice is false', async () => {
      let capturedOnTimeout: ((ctx: TimeoutContext) => void) | null = null;
      castTo<MockInstance>(retryWithTimeout).mockImplementationOnce(async (options: Record<string, unknown>) => {
        capturedOnTimeout = options['onTimeout'] as (ctx: TimeoutContext) => void;
      });

      await retryWithTimeoutNotice({
        operationFn: async () => true,
        shouldShowTimeoutNotice: false
      });

      expect(capturedOnTimeout).toBeTypeOf('function');
    });

    it('should pass onTimeoutWithoutNotice as onTimeout when shouldShowTimeoutNotice is undefined', async () => {
      let capturedOnTimeoutWithFalse: ((ctx: TimeoutContext) => void) | null = null;
      let capturedOnTimeoutWithUndefined: ((ctx: TimeoutContext) => void) | null = null;

      castTo<MockInstance>(retryWithTimeout).mockImplementationOnce(async (options: Record<string, unknown>) => {
        capturedOnTimeoutWithFalse = options['onTimeout'] as (ctx: TimeoutContext) => void;
      });
      await retryWithTimeoutNotice({
        operationFn: async () => true,
        shouldShowTimeoutNotice: false
      });

      castTo<MockInstance>(retryWithTimeout).mockImplementationOnce(async (options: Record<string, unknown>) => {
        capturedOnTimeoutWithUndefined = options['onTimeout'] as (ctx: TimeoutContext) => void;
      });
      await retryWithTimeoutNotice({
        operationFn: async () => true
      });

      // Both false and undefined should use the same onTimeout function (onTimeoutWithoutNotice)
      expect(capturedOnTimeoutWithFalse).toBe(capturedOnTimeoutWithUndefined);
    });

    it('should use a different onTimeout for true vs false shouldShowTimeoutNotice', async () => {
      let capturedOnTimeoutTrue: ((ctx: TimeoutContext) => void) | null = null;
      let capturedOnTimeoutFalse: ((ctx: TimeoutContext) => void) | null = null;

      castTo<MockInstance>(retryWithTimeout).mockImplementationOnce(async (options: Record<string, unknown>) => {
        capturedOnTimeoutTrue = options['onTimeout'] as (ctx: TimeoutContext) => void;
      });
      await retryWithTimeoutNotice({
        operationFn: async () => true,
        shouldShowTimeoutNotice: true
      });

      castTo<MockInstance>(retryWithTimeout).mockImplementationOnce(async (options: Record<string, unknown>) => {
        capturedOnTimeoutFalse = options['onTimeout'] as (ctx: TimeoutContext) => void;
      });
      await retryWithTimeoutNotice({
        operationFn: async () => true,
        shouldShowTimeoutNotice: false
      });

      expect(capturedOnTimeoutTrue).not.toBe(capturedOnTimeoutFalse);
    });
  });

  describe('runWithTimeoutNotice', () => {
    it('should call runWithTimeout with the provided options', async () => {
      const operationFn = vi.fn(async () => 42);
      await runWithTimeoutNotice({
        operationFn,
        timeoutInMilliseconds: 5000
      });
      expect(runWithTimeout).toHaveBeenCalledTimes(1);
    });

    it('should return the result from the operation', async () => {
      const result = await runWithTimeoutNotice({
        operationFn: async () => 'test-result',
        timeoutInMilliseconds: 5000
      });
      expect(result).toBe('test-result');
    });

    it('should return the result for synchronous operationFn', async () => {
      const result = await runWithTimeoutNotice({
        operationFn: () => 123,
        timeoutInMilliseconds: 5000
      });
      expect(result).toBe(123);
    });

    it('should forward operationFn to runWithTimeout', async () => {
      const operationFn = vi.fn(async () => 'value');
      await runWithTimeoutNotice({
        operationFn,
        timeoutInMilliseconds: 5000
      });
      const callArgs = castTo<MockInstance>(runWithTimeout).mock.calls[0]?.[0] as Record<string, unknown>;
      expect(callArgs['operationFn']).toBe(operationFn);
    });

    it('should forward operationName to runWithTimeout', async () => {
      await runWithTimeoutNotice({
        operationFn: async () => 'value',
        operationName: 'myOp',
        timeoutInMilliseconds: 5000
      });
      const callArgs = castTo<MockInstance>(runWithTimeout).mock.calls[0]?.[0] as Record<string, unknown>;
      expect(callArgs['operationName']).toBe('myOp');
    });

    it('should forward timeoutInMilliseconds to runWithTimeout', async () => {
      await runWithTimeoutNotice({
        operationFn: async () => 'value',
        timeoutInMilliseconds: 3000
      });
      const callArgs = castTo<MockInstance>(runWithTimeout).mock.calls[0]?.[0] as Record<string, unknown>;
      expect(callArgs['timeoutInMilliseconds']).toBe(3000);
    });

    it('should forward stackTrace to runWithTimeout', async () => {
      await runWithTimeoutNotice({
        operationFn: async () => 'value',
        stackTrace: 'my-stack',
        timeoutInMilliseconds: 5000
      });
      const callArgs = castTo<MockInstance>(runWithTimeout).mock.calls[0]?.[0] as Record<string, unknown>;
      expect(callArgs['stackTrace']).toBe('my-stack');
    });

    it('should forward context to runWithTimeout', async () => {
      const context = { some: 'data' };
      await runWithTimeoutNotice({
        context,
        operationFn: async () => 'value',
        timeoutInMilliseconds: 5000
      });
      const callArgs = castTo<MockInstance>(runWithTimeout).mock.calls[0]?.[0] as Record<string, unknown>;
      expect(callArgs['context']).toBe(context);
    });

    it('should pass onTimeoutNotice as onTimeout when shouldShowTimeoutNotice is true', async () => {
      let capturedOnTimeout: ((ctx: TimeoutContext) => void) | null = null;
      castTo<MockInstance>(runWithTimeout).mockImplementationOnce(async (options: Record<string, unknown>) => {
        capturedOnTimeout = options['onTimeout'] as (ctx: TimeoutContext) => void;
        return undefined;
      });

      await runWithTimeoutNotice({
        operationFn: async () => 'value',
        shouldShowTimeoutNotice: true,
        timeoutInMilliseconds: 5000
      });

      expect(capturedOnTimeout).toBeTypeOf('function');
    });

    it('should pass onTimeoutWithoutNotice as onTimeout when shouldShowTimeoutNotice is false', async () => {
      let capturedOnTimeout: ((ctx: TimeoutContext) => void) | null = null;
      castTo<MockInstance>(runWithTimeout).mockImplementationOnce(async (options: Record<string, unknown>) => {
        capturedOnTimeout = options['onTimeout'] as (ctx: TimeoutContext) => void;
        return undefined;
      });

      await runWithTimeoutNotice({
        operationFn: async () => 'value',
        shouldShowTimeoutNotice: false,
        timeoutInMilliseconds: 5000
      });

      expect(capturedOnTimeout).toBeTypeOf('function');
    });

    it('should use different onTimeout functions for true vs false', async () => {
      let capturedOnTimeoutTrue: ((ctx: TimeoutContext) => void) | null = null;
      let capturedOnTimeoutFalse: ((ctx: TimeoutContext) => void) | null = null;

      castTo<MockInstance>(runWithTimeout).mockImplementationOnce(async (options: Record<string, unknown>) => {
        capturedOnTimeoutTrue = options['onTimeout'] as (ctx: TimeoutContext) => void;
        return undefined;
      });
      await runWithTimeoutNotice({
        operationFn: async () => 'value',
        shouldShowTimeoutNotice: true,
        timeoutInMilliseconds: 5000
      });

      castTo<MockInstance>(runWithTimeout).mockImplementationOnce(async (options: Record<string, unknown>) => {
        capturedOnTimeoutFalse = options['onTimeout'] as (ctx: TimeoutContext) => void;
        return undefined;
      });
      await runWithTimeoutNotice({
        operationFn: async () => 'value',
        shouldShowTimeoutNotice: false,
        timeoutInMilliseconds: 5000
      });

      expect(capturedOnTimeoutTrue).not.toBe(capturedOnTimeoutFalse);
    });
  });

  describe('onTimeoutNotice (tested indirectly)', () => {
    function captureOnTimeoutNotice(): Promise<(ctx: TimeoutContext) => void> {
      return new Promise((resolve) => {
        castTo<MockInstance>(retryWithTimeout).mockImplementationOnce(async (options: Record<string, unknown>) => {
          resolve(options['onTimeout'] as (ctx: TimeoutContext) => void);
        });
        retryWithTimeoutNotice({
          operationFn: async () => true,
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
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

      onTimeout(ctx);

      expect(onOperationCompletedMock).toHaveBeenCalledTimes(1);
      expect(onOperationCompletedCallbacks.length).toBe(1);

      // Simulate the operation completing
      const callback = onOperationCompletedCallbacks[0];
      assertNonNullable(callback);
      callback();

      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
      cleanup();
    });

    it('should set up an interval to update running time', async () => {
      const onTimeout = await captureOnTimeoutNotice();
      const ctx = createMockTimeoutContext();

      const { cleanup } = setupCreateFragmentGlobal();
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

      onTimeout(ctx);

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

      setIntervalSpy.mockRestore();
      cleanup();
    });

    it('should clear interval when cancel button is clicked', async () => {
      const onTimeout = await captureOnTimeoutNotice();
      const ctx = createMockTimeoutContext();

      const { cleanup, getLastFragment } = setupCreateFragmentGlobal();
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

      onTimeout(ctx);

      const fragment = getLastFragment();
      const button = fragment?.querySelector('button');
      expect(button).not.toBeNull();
      button?.click();

      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
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
        castTo<MockInstance>(retryWithTimeout).mockImplementationOnce(async (options: Record<string, unknown>) => {
          resolve(options['onTimeout'] as (ctx: TimeoutContext) => void);
        });
        retryWithTimeoutNotice({
          operationFn: async () => true,
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
      castTo<MockInstance>(getDebugger).mockReturnValue(mockDebugFn);

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
});
