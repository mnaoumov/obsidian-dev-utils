import type { MockedFunction } from 'vitest';

// @vitest-environment jsdom
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  invokeAsyncSafely,
  requestAnimationFrameAsync
} from '../../src/Async.ts';
import { getLibDebugger } from '../../src/Debug.ts';
import {
  emitAsyncErrorEvent,
  getStackTrace
} from '../../src/Error.ts';
import { noop } from '../../src/Function.ts';
import { loop } from '../../src/obsidian/Loop.ts';
import { addPluginCssClasses } from '../../src/obsidian/Plugin/PluginContext.ts';
import { assertNotNullable } from '../TestHelpers.ts';

vi.mock('../../src/AbortController.ts', () => ({
  abortSignalNever: vi.fn(() => new AbortController().signal)
}));

vi.mock('../../src/Async.ts', () => ({
  invokeAsyncSafely: vi.fn((fn: () => Promise<unknown>) => {
    fn().catch(() => undefined);
  }),
  requestAnimationFrameAsync: vi.fn(() => Promise.resolve())
}));

vi.mock('../../src/Debug.ts', () => ({
  getLibDebugger: vi.fn(() => vi.fn())
}));

vi.mock('../../src/Error.ts', () => ({
  ASYNC_WRAPPER_ERROR_MESSAGE: 'async wrapper error',
  CustomStackTraceError: class CustomStackTraceError extends Error {
    public constructor(message: string, public stackTraceStr: string, public override cause?: unknown) {
      super(message, { cause });
      this.name = 'CustomStackTraceError';
    }
  },
  emitAsyncErrorEvent: vi.fn(),
  getStackTrace: vi.fn(() => 'mock stack trace')
}));

vi.mock('../../src/Function.ts', () => ({
  noop: vi.fn(),
  noopAsync: vi.fn(() => Promise.resolve())
}));

vi.mock('../../src/obsidian/Plugin/PluginContext.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

if (typeof globalThis.createEl === 'undefined') {
  (globalThis as Record<string, unknown>)['createEl'] = (tag: string): HTMLElement => document.createElement(tag);
}

// Obsidian augments Node.prototype with createDiv
if (!('createDiv' in DocumentFragment.prototype)) {
  (DocumentFragment.prototype as Record<string, unknown>)['createDiv'] = function createDiv(
    this: DocumentFragment,
    o?: Record<string, unknown> | string
  ): HTMLDivElement {
    const div = document.createElement('div');
    if (typeof o === 'string') {
      div.textContent = o;
    } else if (o && typeof o === 'object' && typeof o['text'] === 'string') {
      div.textContent = o['text'];
    }
    this.appendChild(div);
    return div;
  };
}

if (typeof globalThis.createFragment === 'undefined') {
  (globalThis as Record<string, unknown>)['createFragment'] = (cb?: (f: DocumentFragment) => void): DocumentFragment => {
    const f = document.createDocumentFragment();
    cb?.(f);
    return f;
  };
}
if (typeof globalThis.sleep === 'undefined') {
  (globalThis as Record<string, unknown>)['sleep'] = (_ms: number): Promise<void> => Promise.resolve();
}

describe('loop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete without error when items array is empty', async () => {
    const processItem = vi.fn();
    const buildNoticeMessage = vi.fn();

    await loop({
      buildNoticeMessage,
      items: [],
      processItem
    });

    expect(processItem).not.toHaveBeenCalled();
    expect(buildNoticeMessage).not.toHaveBeenCalled();
  });

  it('should call processItem for each item', async () => {
    const processItem = vi.fn();
    const items = ['a', 'b', 'c'];

    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items,
      processItem,
      shouldShowNotice: false
    });

    expect(processItem).toHaveBeenCalledTimes(3);
    expect(processItem).toHaveBeenCalledWith('a');
    expect(processItem).toHaveBeenCalledWith('b');
    expect(processItem).toHaveBeenCalledWith('c');
  });

  it('should call buildNoticeMessage for each item with correct iteration string', async () => {
    const buildNoticeMessage = vi.fn(() => 'msg');
    const items = ['x', 'y'];

    await loop({
      buildNoticeMessage,
      items,
      processItem: vi.fn(),
      shouldShowNotice: false
    });

    expect(buildNoticeMessage).toHaveBeenCalledTimes(2);
    expect(buildNoticeMessage).toHaveBeenCalledWith('x', '# 1 / 2');
    expect(buildNoticeMessage).toHaveBeenCalledWith('y', '# 2 / 2');
  });

  it('should stop processing when abortSignal is already aborted', async () => {
    const processItem = vi.fn();
    const controller = new AbortController();
    controller.abort();

    await loop({
      abortSignal: controller.signal,
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a', 'b'],
      processItem,
      shouldShowNotice: false
    });

    expect(processItem).not.toHaveBeenCalled();
  });

  it('should stop processing when abortSignal is aborted mid-loop', async () => {
    const controller = new AbortController();
    const processItem = vi.fn(async () => {
      controller.abort();
    });

    await loop({
      abortSignal: controller.signal,
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a', 'b', 'c'],
      processItem,
      shouldShowNotice: false
    });

    expect(processItem).toHaveBeenCalledTimes(1);
    expect(processItem).toHaveBeenCalledWith('a');
  });

  it('should continue on error when shouldContinueOnError is true (default)', async () => {
    const error = new Error('test error');
    const processItem = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      noop();
    });

    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a', 'b', 'c'],
      processItem,
      shouldShowNotice: false
    });

    expect(processItem).toHaveBeenCalledTimes(3);
    expect(emitAsyncErrorEvent).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error processing item', 'a');

    consoleErrorSpy.mockRestore();
  });

  it('should throw when shouldContinueOnError is false and an error occurs', async () => {
    const error = new Error('processing failed');
    const processItem = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(error);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      noop();
    });

    await expect(loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a', 'b', 'c'],
      processItem,
      shouldContinueOnError: false,
      shouldShowNotice: false
    })).rejects.toThrow('loop failed');

    expect(processItem).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error processing item', 'b');

    consoleErrorSpy.mockRestore();
  });

  it('should not show notice when shouldShowNotice is false', async () => {
    const mockedInvokeAsyncSafely = invokeAsyncSafely as MockedFunction<typeof invokeAsyncSafely>;

    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a'],
      processItem: vi.fn(),
      shouldShowNotice: false
    });

    expect(mockedInvokeAsyncSafely).toHaveBeenCalledTimes(1);

    const showNoticeFn = mockedInvokeAsyncSafely.mock.calls[0]?.[0] as (() => Promise<void>) | undefined;
    expect(showNoticeFn).toBeDefined();
    if (showNoticeFn) {
      await showNoticeFn();
    }
  });

  it('should call getStackTrace at the beginning', async () => {
    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a'],
      processItem: vi.fn(),
      shouldShowNotice: false
    });

    expect(getStackTrace).toHaveBeenCalledWith(1);
  });

  it('should call getLibDebugger with Loop namespace', async () => {
    const mockDebugFn = vi.fn();
    (getLibDebugger as MockedFunction<typeof getLibDebugger>).mockReturnValue(mockDebugFn as unknown as ReturnType<typeof getLibDebugger>);

    await loop({
      buildNoticeMessage: vi.fn(() => 'debug msg'),
      items: ['a'],
      processItem: vi.fn(),
      shouldShowNotice: false
    });

    expect(getLibDebugger).toHaveBeenCalledWith('Loop');
    expect(mockDebugFn).toHaveBeenCalledWith('debug msg');
  });

  it('should call addPluginCssClasses on the progress bar element', async () => {
    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a'],
      processItem: vi.fn(),
      shouldShowNotice: false
    });

    expect(addPluginCssClasses).toHaveBeenCalledTimes(1);
    const call = (addPluginCssClasses as MockedFunction<typeof addPluginCssClasses>).mock.calls[0];
    expect(call).toBeDefined();
    expect(call?.[0]).toBeInstanceOf(HTMLProgressElement);
    expect(call?.[1]).toBe('loop');
  });

  it('should set progress bar max to items length', async () => {
    const items = ['a', 'b', 'c', 'd', 'e'];

    const origCreateEl = globalThis.createEl;
    let capturedProgressEl: HTMLProgressElement | null = null;
    (globalThis as Record<string, unknown>)['createEl'] = (tag: string): HTMLElement => {
      const el = document.createElement(tag);
      if (tag === 'progress') {
        capturedProgressEl = el as HTMLProgressElement;
      }
      return el;
    };

    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items,
      processItem: vi.fn(),
      shouldShowNotice: false
    });

    assertNotNullable(capturedProgressEl);
    const progressEl: HTMLProgressElement = capturedProgressEl;
    expect(progressEl.max).toBe(5);
    expect(progressEl.value).toBe(5);

    (globalThis as Record<string, unknown>)['createEl'] = origCreateEl;
  });

  it('should process items with numeric type', async () => {
    const processItem = vi.fn();
    const items = [1, 2, 3];

    await loop({
      buildNoticeMessage: vi.fn((_item: number, iterationStr: string) => `Processing ${iterationStr}`),
      items,
      processItem,
      shouldShowNotice: false
    });

    expect(processItem).toHaveBeenCalledTimes(3);
    expect(processItem).toHaveBeenCalledWith(1);
    expect(processItem).toHaveBeenCalledWith(2);
    expect(processItem).toHaveBeenCalledWith(3);
  });

  it('should handle async processItem functions', async () => {
    const results: string[] = [];
    const processItem = vi.fn(async (item: string) => {
      results.push(item);
    });

    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['first', 'second', 'third'],
      processItem,
      shouldShowNotice: false
    });

    expect(results).toEqual(['first', 'second', 'third']);
  });

  it('should handle multiple errors with shouldContinueOnError true', async () => {
    const processItem = vi.fn()
      .mockRejectedValueOnce(new Error('err1'))
      .mockRejectedValueOnce(new Error('err2'))
      .mockResolvedValueOnce(undefined);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      noop();
    });

    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a', 'b', 'c'],
      processItem,
      shouldShowNotice: false
    });

    expect(processItem).toHaveBeenCalledTimes(3);
    expect(emitAsyncErrorEvent).toHaveBeenCalledTimes(2);

    consoleErrorSpy.mockRestore();
  });

  it('should respect custom options', async () => {
    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a'],
      noticeBeforeShownTimeoutInMilliseconds: 1000,
      noticeMinTimeoutInMilliseconds: 5000,
      processItem: vi.fn(),
      progressBarTitle: 'Custom Title',
      shouldContinueOnError: false,
      shouldShowNotice: true,
      shouldShowProgressBar: true,
      uiUpdateThresholdInMilliseconds: 200
    });

    expect(invokeAsyncSafely).toHaveBeenCalledTimes(1);
  });

  it('should use default abortSignal from abortSignalNever when none provided', async () => {
    const { abortSignalNever } = await import('../../src/AbortController.ts');

    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a'],
      processItem: vi.fn(),
      shouldShowNotice: false
    });

    expect(abortSignalNever).toHaveBeenCalled();
  });

  it('should process items in order', async () => {
    const order: number[] = [];
    const processItem = vi.fn((item: number) => {
      order.push(item);
    });

    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: [10, 20, 30, 40, 50],
      processItem,
      shouldShowNotice: false
    });

    expect(order).toEqual([10, 20, 30, 40, 50]);
  });

  it('should increment progress bar value for each processed item', async () => {
    const origCreateEl = globalThis.createEl;
    let capturedProgressEl: HTMLProgressElement | null = null;
    (globalThis as Record<string, unknown>)['createEl'] = (tag: string): HTMLElement => {
      const el = document.createElement(tag);
      if (tag === 'progress') {
        capturedProgressEl = el as HTMLProgressElement;
      }
      return el;
    };

    const values: number[] = [];
    const processItem = vi.fn(() => {
      if (capturedProgressEl) {
        values.push(capturedProgressEl.value);
      }
    });

    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a', 'b', 'c'],
      processItem,
      shouldShowNotice: false
    });

    // During processItem calls, value hasn't been incremented yet (it happens after processItem)
    // After each iteration, value is incremented. The values captured during processItem
    // Are 0, 1, 2 because value++ happens after processItem returns.
    expect(values).toEqual([0, 1, 2]);
    assertNotNullable(capturedProgressEl);
    expect((capturedProgressEl as HTMLProgressElement).value).toBe(3);

    (globalThis as Record<string, unknown>)['createEl'] = origCreateEl;
  });

  it('should still increment progress bar value even when processItem throws', async () => {
    const origCreateEl = globalThis.createEl;
    let capturedProgressEl: HTMLProgressElement | null = null;
    (globalThis as Record<string, unknown>)['createEl'] = (tag: string): HTMLElement => {
      const el = document.createElement(tag);
      if (tag === 'progress') {
        capturedProgressEl = el as HTMLProgressElement;
      }
      return el;
    };

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      noop();
    });

    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a', 'b'],
      processItem: vi.fn().mockRejectedValue(new Error('fail')),
      shouldContinueOnError: true,
      shouldShowNotice: false
    });

    assertNotNullable(capturedProgressEl);
    expect((capturedProgressEl as HTMLProgressElement).value).toBe(2);

    consoleErrorSpy.mockRestore();
    (globalThis as Record<string, unknown>)['createEl'] = origCreateEl;
  });

  it('should work with a single item', async () => {
    const processItem = vi.fn();
    const buildNoticeMessage = vi.fn(() => 'single');

    await loop({
      buildNoticeMessage,
      items: ['only'],
      processItem,
      shouldShowNotice: false
    });

    expect(processItem).toHaveBeenCalledTimes(1);
    expect(processItem).toHaveBeenCalledWith('only');
    expect(buildNoticeMessage).toHaveBeenCalledWith('only', '# 1 / 1');
  });

  it('should call requestAnimationFrameAsync when UI update threshold is exceeded', async () => {
    let callCount = 0;
    const performanceNowSpy = vi.spyOn(performance, 'now').mockImplementation(() => {
      // Return increasing timestamps that exceed the default 100ms threshold
      return callCount++ * 200;
    });

    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a', 'b'],
      processItem: vi.fn(),
      shouldShowNotice: false
    });

    expect(requestAnimationFrameAsync).toHaveBeenCalled();

    performanceNowSpy.mockRestore();
  });

  it('should set notice message when shouldShowProgressBar is false and notice exists', async () => {
    // Make invokeAsyncSafely actually await the function so the notice gets created
    const mockedInvokeAsyncSafely = invokeAsyncSafely as MockedFunction<typeof invokeAsyncSafely>;
    // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Must be async to ensure notice is created before loop iterates.
    mockedInvokeAsyncSafely.mockImplementation(async (fn: () => Promise<unknown>) => {
      await fn();
    });

    const { Notice } = await import('obsidian');
    const setMessageSpy = vi.spyOn(Notice.prototype, 'setMessage');

    await loop({
      buildNoticeMessage: vi.fn(() => 'progress message'),
      items: ['a', 'b'],
      processItem: vi.fn(),
      shouldShowNotice: true,
      shouldShowProgressBar: false
    });

    // Notice.setMessage should have been called with the string message (not a fragment)
    expect(setMessageSpy).toHaveBeenCalledWith('progress message');

    setMessageSpy.mockRestore();
  });

  it('should return early from showNotice when shouldShowProgressBar is false', async () => {
    // Make invokeAsyncSafely actually await so the notice is created
    const mockedInvokeAsyncSafely = invokeAsyncSafely as MockedFunction<typeof invokeAsyncSafely>;
    // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Must be async to ensure notice is created before loop iterates.
    mockedInvokeAsyncSafely.mockImplementation(async (fn: () => Promise<unknown>) => {
      await fn();
    });

    const { Notice } = await import('obsidian');
    const constructorSpy = vi.spyOn(Notice.prototype, 'setMessage');

    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a'],
      processItem: vi.fn(),
      shouldShowNotice: true,
      shouldShowProgressBar: false
    });

    // When shouldShowProgressBar is false, notice is created but setMessage with
    // Fragment is NOT called (it returns early). setMessage is only called with
    // The string message for each item.
    for (const call of constructorSpy.mock.calls) {
      expect(typeof call[0]).toBe('string');
    }

    constructorSpy.mockRestore();
  });
});
