// @vitest-environment jsdom
import { Notice } from 'obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { abortSignalNever } from '../abort-controller.ts';
import {
  invokeAsyncSafely,
  requestAnimationFrameAsync
} from '../async.ts';
import { getLibDebugger } from '../debug.ts';
import {
  emitAsyncErrorEvent,
  getStackTrace
} from '../error.ts';
import {
  noop,
  noopAsync
} from '../function.ts';
import { castTo } from '../object-utils.ts';
import { mockImplementation } from '../test-helpers/mock-implementation.ts';
import { assertNonNullable } from '../type-guards.ts';
import { loop } from './loop.ts';
import { addPluginCssClasses } from './plugin/plugin-context.ts';

vi.mock('../abort-controller.ts', () => ({
  abortSignalNever: vi.fn(() => new AbortController().signal)
}));

vi.mock('../async.ts', () => ({
  invokeAsyncSafely: vi.fn((fn: () => Promise<unknown>) => {
    fn().catch(() => undefined);
  }),
  requestAnimationFrameAsync: vi.fn(() => Promise.resolve())
}));

vi.mock('../debug.ts', () => ({
  getLibDebugger: vi.fn(() => vi.fn())
}));

vi.mock('../error.ts', () => ({
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

vi.mock('../function.ts', () => ({
  noop: vi.fn(),
  noopAsync: vi.fn(() => Promise.resolve())
}));

vi.mock('../obsidian/plugin/plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

function sleepImmediate(_ms: number): Promise<void> {
  return Promise.resolve();
}

describe('loop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(
      // eslint-disable-next-line obsidianmd/prefer-active-doc -- Actively use globalThis.
      globalThis,
      'sleep'
    ).mockImplementation(sleepImmediate);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
      await noopAsync();
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

    vi.spyOn(console, 'error').mockImplementation(() => {
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

    expect(vi.mocked(console.error)).toHaveBeenCalledWith('Error processing item', 'a');

    vi.mocked(console.error).mockRestore();
  });

  it('should throw when shouldContinueOnError is false and an error occurs', async () => {
    const error = new Error('processing failed');
    const processItem = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(error);

    vi.spyOn(console, 'error').mockImplementation(() => {
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

    expect(vi.mocked(console.error)).toHaveBeenCalledWith('Error processing item', 'b');

    vi.mocked(console.error).mockRestore();
  });

  it('should not show notice when shouldShowNotice is false', async () => {
    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a'],
      processItem: vi.fn(),
      shouldShowNotice: false
    });

    expect(vi.mocked(invokeAsyncSafely)).toHaveBeenCalledTimes(1);

    const showNoticeFn = vi.mocked(invokeAsyncSafely).mock.calls[0]?.[0] as (() => Promise<void>) | undefined;
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

    vi.mocked(getLibDebugger).mockReturnValue(castTo<ReturnType<typeof getLibDebugger>>(mockDebugFn));

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
    const call = vi.mocked(addPluginCssClasses).mock.calls[0];
    expect(call).toBeDefined();
    expect(call?.[0]).toBeInstanceOf(HTMLProgressElement);
    expect(call?.[1]).toBe('loop');
  });

  it('should set progress bar max to items length', async () => {
    const items = ['a', 'b', 'c', 'd', 'e'];

    let capturedProgressEl: HTMLProgressElement | null = null;
    // eslint-disable-next-line obsidianmd/prefer-active-doc -- Actively use globalThis.
    const createElSpy = mockImplementation(globalThis, 'createEl', (originalImplementation, tag: keyof HTMLElementTagNameMap): HTMLElement => {
      const el = originalImplementation(tag);
      if (tag === 'progress') {
        capturedProgressEl = el as HTMLProgressElement;
      }
      return el;
    });

    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items,
      processItem: vi.fn(),
      shouldShowNotice: false
    });

    assertNonNullable(capturedProgressEl);
    const progressEl: HTMLProgressElement = capturedProgressEl;
    expect(progressEl.max).toBe(5);
    expect(progressEl.value).toBe(5);

    createElSpy.mockRestore();
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
      await noopAsync();
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

    vi.spyOn(console, 'error').mockImplementation(() => {
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

    vi.mocked(console.error).mockRestore();
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
    let capturedProgressEl: HTMLProgressElement | null = null;
    // eslint-disable-next-line obsidianmd/prefer-active-doc -- Actively use globalThis.
    const createElSpy = mockImplementation(globalThis, 'createEl', (originalImplementation, tag: keyof HTMLElementTagNameMap): HTMLElement => {
      const el = originalImplementation(tag);
      if (tag === 'progress') {
        capturedProgressEl = el as HTMLProgressElement;
      }
      return el;
    });

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
    assertNonNullable(capturedProgressEl);
    expect((capturedProgressEl as HTMLProgressElement).value).toBe(3);

    createElSpy.mockRestore();
  });

  it('should still increment progress bar value even when processItem throws', async () => {
    let capturedProgressEl: HTMLProgressElement | null = null;
    // eslint-disable-next-line obsidianmd/prefer-active-doc -- Actively use globalThis.
    const createElSpy = mockImplementation(globalThis, 'createEl', (originalImplementation, tag: keyof HTMLElementTagNameMap): HTMLElement => {
      const el = originalImplementation(tag);
      if (tag === 'progress') {
        capturedProgressEl = el as HTMLProgressElement;
      }
      return el;
    });

    vi.spyOn(console, 'error').mockImplementation(() => {
      noop();
    });

    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a', 'b'],
      processItem: vi.fn().mockRejectedValue(new Error('fail')),
      shouldContinueOnError: true,
      shouldShowNotice: false
    });

    assertNonNullable(capturedProgressEl);
    expect((capturedProgressEl as HTMLProgressElement).value).toBe(2);

    vi.mocked(console.error).mockRestore();
    createElSpy.mockRestore();
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
    vi.spyOn(performance, 'now').mockImplementation(() => {
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
    vi.mocked(performance.now).mockRestore();
  });

  it('should set notice message when shouldShowProgressBar is false and notice exists', async () => {
    // Make invokeAsyncSafely actually await the function so the notice gets created
    // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Must be async to ensure notice is created before loop iterates.
    vi.mocked(invokeAsyncSafely).mockImplementation(async (fn: () => unknown) => {
      await fn();
    });

    vi.spyOn(Notice.prototype, 'setMessage');

    await loop({
      buildNoticeMessage: vi.fn(() => 'progress message'),
      items: ['a', 'b'],
      processItem: vi.fn(),
      shouldShowNotice: true,
      shouldShowProgressBar: false
    });

    // Notice.setMessage should have been called with the string message (not a fragment)
    expect(vi.mocked(Notice.prototype.setMessage)).toHaveBeenCalledWith('progress message');
    vi.mocked(Notice.prototype.setMessage).mockRestore();
  });

  it('should return early from showNotice when shouldShowProgressBar is false', async () => {
    // Make invokeAsyncSafely actually await so the notice is created
    // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Must be async to ensure notice is created before loop iterates.
    vi.mocked(invokeAsyncSafely).mockImplementation(async (fn: () => unknown) => {
      await fn();
    });

    vi.spyOn(Notice.prototype, 'setMessage');

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
    for (const call of vi.mocked(Notice.prototype.setMessage).mock.calls) {
      expect(typeof call[0]).toBe('string');
    }

    vi.mocked(Notice.prototype.setMessage).mockRestore();
  });
});
