// @vitest-environment jsdom
import type { Mock } from 'vitest';

import {
  App,
  Notice
} from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { CustomStackTraceErrorConstructorParams } from '../error.ts';
import type {
  PluginNoticeComponentDelayedNotice,
  PluginNoticeComponentShowNoticeAfterDelayParams
} from './components/plugin-notice-component.ts';
import type { LoopBuildNoticeMessageParams } from './loop.ts';

import { abortSignalNever } from '../abort-controller.ts';
import { requestAnimationFrameAsync } from '../async.ts';
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
import { strictProxy } from '../strict-proxy.ts';
import { mockImplementation } from '../test-helpers/mock-implementation.ts';
import { assertNonNullable } from '../type-guards.ts';
import { resolveValue } from '../value-provider.ts';
import { PluginNoticeComponent } from './components/plugin-notice-component.ts';
import { loop } from './loop.ts';
import { addPluginCssClasses } from './plugin/plugin-context.ts';

vi.mock('../abort-controller.ts', () => ({
  abortSignalNever: vi.fn(() => new AbortController().signal)
}));

vi.mock('../async.ts', () => ({
  invokeAsyncSafely: vi.fn(($function: () => Promise<unknown>) => {
    $function().catch(() => undefined);
  }),
  requestAnimationFrameAsync: vi.fn(() => noopAsync())
}));

vi.mock('../debug.ts', () => ({
  getLibDebugger: vi.fn(() => vi.fn())
}));

vi.mock('../error.ts', () => ({
  ASYNC_WRAPPER_ERROR_MESSAGE: 'async wrapper error',
  CustomStackTraceError: class CustomStackTraceError extends Error {
    public stackTraceString: string;

    public constructor(params: CustomStackTraceErrorConstructorParams) {
      super(params.message, { cause: params.cause });
      this.stackTraceString = params.stackTrace;
      this.name = 'CustomStackTraceError';
    }
  },
  emitAsyncErrorEvent: vi.fn(),
  getStackTrace: vi.fn(() => 'mock stack trace')
}));

const functionMocks = vi.hoisted(() => {
  // eslint-disable-next-line obsidian-dev-utils/prefer-noop-async -- Cannot use noopAsync() in vi.hoisted() since imports are not yet available.
  const resolvedPromise = Promise.resolve();
  return {
    noop: vi.fn(),
    noopAsync: vi.fn(() => resolvedPromise)
  };
});

vi.mock('../function.ts', () => functionMocks);

vi.mock('../obsidian/plugin/plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

interface FakePluginNoticeComponent {
  readonly delayedNotice: PluginNoticeComponentDelayedNotice;
  readonly dispose: Mock<() => void>;
  readonly pluginNoticeComponent: PluginNoticeComponent;
  readonly setContent: Mock<(content: DocumentFragment | string) => void>;
  readonly showNoticeAfterDelay: Mock<(params: PluginNoticeComponentShowNoticeAfterDelayParams) => PluginNoticeComponentDelayedNotice>;
}

function createFakePluginNoticeComponent(): FakePluginNoticeComponent {
  const dispose = vi.fn<() => void>();
  const setContent = vi.fn<(content: DocumentFragment | string) => void>();
  const delayedNotice: PluginNoticeComponentDelayedNotice = {
    setContent,
    [Symbol.dispose]: dispose
  };
  const showNoticeAfterDelay = vi.fn<(params: PluginNoticeComponentShowNoticeAfterDelayParams) => PluginNoticeComponentDelayedNotice>(
    () => delayedNotice
  );
  return {
    delayedNotice,
    dispose,
    pluginNoticeComponent: strictProxy<PluginNoticeComponent>({ showNoticeAfterDelay }),
    setContent,
    showNoticeAfterDelay
  };
}

/**
 * Resolves the content the loop handed to `showNoticeAfterDelay`, as the component does once the delay elapses.
 */
async function resolveNoticeContent(fake: FakePluginNoticeComponent): Promise<DocumentFragment | string> {
  const params = fake.showNoticeAfterDelay.mock.calls[0]?.[0];
  assertNonNullable(params);
  return await resolveValue(params.content, {});
}

function sleepImmediate(_ms: number): Promise<void> {
  return noopAsync();
}

describe('loop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(
      // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
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

    const fake = createFakePluginNoticeComponent();

    await loop({
      buildNoticeMessage,
      items: [],
      pluginNoticeComponent: fake.pluginNoticeComponent,
      processItem
    });

    expect(processItem).not.toHaveBeenCalled();
    expect(buildNoticeMessage).not.toHaveBeenCalled();
    expect(fake.dispose).toHaveBeenCalledTimes(1);
  });

  it('should call processItem for each item', async () => {
    const processItem = vi.fn();
    const items = ['a', 'b', 'c'];

    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items,
      pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
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
      pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
      processItem: vi.fn(),
      shouldShowNotice: false
    });

    expect(buildNoticeMessage).toHaveBeenCalledTimes(2);
    expect(buildNoticeMessage).toHaveBeenCalledWith({ item: 'x', iterationString: '# 1 / 2' });
    expect(buildNoticeMessage).toHaveBeenCalledWith({ item: 'y', iterationString: '# 2 / 2' });
  });

  it('should stop processing when abortSignal is already aborted', async () => {
    const processItem = vi.fn();
    const controller = new AbortController();
    controller.abort();

    await loop({
      abortSignal: controller.signal,
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a', 'b'],
      pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
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
      pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
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
      pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
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
      pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
      processItem,
      shouldContinueOnError: false,
      shouldShowNotice: false
    })).rejects.toThrow('loop failed');

    expect(processItem).toHaveBeenCalledTimes(2);

    expect(vi.mocked(console.error)).toHaveBeenCalledWith('Error processing item', 'b');

    vi.mocked(console.error).mockRestore();
  });

  it('should not show notice when shouldShowNotice is false', async () => {
    const fake = createFakePluginNoticeComponent();

    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a'],
      pluginNoticeComponent: fake.pluginNoticeComponent,
      processItem: vi.fn(),
      shouldShowNotice: false
    });

    expect(fake.showNoticeAfterDelay).not.toHaveBeenCalled();
  });

  it('should call getStackTrace at the beginning', async () => {
    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a'],
      pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
      processItem: vi.fn(),
      shouldShowNotice: false
    });

    expect(getStackTrace).toHaveBeenCalledWith(1);
  });

  it('should call getLibDebugger with Loop namespace', async () => {
    const mockDebugFunction = vi.fn();

    vi.mocked(getLibDebugger).mockReturnValue(castTo<ReturnType<typeof getLibDebugger>>(mockDebugFunction));

    await loop({
      buildNoticeMessage: vi.fn(() => 'debug msg'),
      items: ['a'],
      pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
      processItem: vi.fn(),
      shouldShowNotice: false
    });

    expect(getLibDebugger).toHaveBeenCalledWith('Loop');
    expect(mockDebugFunction).toHaveBeenCalledWith('debug msg');
  });

  it('should call addPluginCssClasses on the progress bar element', async () => {
    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a'],
      pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
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
    const createElementSpy = mockImplementation({
      // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
      $object: globalThis,
      impl: (originalImplementation, tag: keyof HTMLElementTagNameMap): HTMLElement => {
        const element = originalImplementation(tag);
        if (tag === 'progress') {
          capturedProgressEl = element as HTMLProgressElement;
        }
        return element;
      },
      method: 'createEl'
    });

    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items,
      pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
      processItem: vi.fn(),
      shouldShowNotice: false
    });

    assertNonNullable(capturedProgressEl);
    const progressEl: HTMLProgressElement = capturedProgressEl;
    expect(progressEl.max).toBe(5);
    expect(progressEl.value).toBe(5);

    createElementSpy.mockRestore();
  });

  it('should process items with numeric type', async () => {
    const processItem = vi.fn();
    const items = [1, 2, 3];

    await loop({
      buildNoticeMessage: vi.fn((params: LoopBuildNoticeMessageParams<number>) => `Processing ${params.iterationString}`),
      items,
      pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
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
      pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
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
      pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
      processItem,
      shouldShowNotice: false
    });

    expect(processItem).toHaveBeenCalledTimes(3);
    expect(emitAsyncErrorEvent).toHaveBeenCalledTimes(2);

    vi.mocked(console.error).mockRestore();
  });

  it('should respect custom options', async () => {
    const fake = createFakePluginNoticeComponent();

    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a'],
      noticeBeforeShownTimeoutInMilliseconds: 1000,
      noticeMinTimeoutInMilliseconds: 5000,
      pluginNoticeComponent: fake.pluginNoticeComponent,
      processItem: vi.fn(),
      progressBarTitle: 'Custom Title',
      shouldContinueOnError: false,
      shouldShowNotice: true,
      shouldShowProgressBar: true,
      uiUpdateThresholdInMilliseconds: 200
    });

    expect(fake.showNoticeAfterDelay).toHaveBeenCalledWith(expect.objectContaining({ delayInMilliseconds: 1000 }));
  });

  it('should use default abortSignal from abortSignalNever when none provided', async () => {
    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a'],
      pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
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
      pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
      processItem,
      shouldShowNotice: false
    });

    expect(order).toEqual([10, 20, 30, 40, 50]);
  });

  it('should increment progress bar value for each processed item', async () => {
    let capturedProgressEl: HTMLProgressElement | null = null;
    const createElementSpy = mockImplementation({
      // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
      $object: globalThis,
      impl: (originalImplementation, tag: keyof HTMLElementTagNameMap): HTMLElement => {
        const element = originalImplementation(tag);
        if (tag === 'progress') {
          capturedProgressEl = element as HTMLProgressElement;
        }
        return element;
      },
      method: 'createEl'
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
      pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
      processItem,
      shouldShowNotice: false
    });

    // During processItem calls, value hasn't been incremented yet (it happens after processItem)
    // after each iteration, value is incremented. The values captured during processItem
    // are 0, 1, 2 because value++ happens after processItem returns.
    expect(values).toEqual([0, 1, 2]);
    assertNonNullable(capturedProgressEl);
    expect((capturedProgressEl as HTMLProgressElement).value).toBe(3);

    createElementSpy.mockRestore();
  });

  it('should still increment progress bar value even when processItem throws', async () => {
    let capturedProgressEl: HTMLProgressElement | null = null;
    const createElementSpy = mockImplementation({
      // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
      $object: globalThis,
      impl: (originalImplementation, tag: keyof HTMLElementTagNameMap): HTMLElement => {
        const element = originalImplementation(tag);
        if (tag === 'progress') {
          capturedProgressEl = element as HTMLProgressElement;
        }
        return element;
      },
      method: 'createEl'
    });

    vi.spyOn(console, 'error').mockImplementation(() => {
      noop();
    });

    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a', 'b'],
      pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
      processItem: vi.fn().mockRejectedValue(new Error('fail')),
      shouldContinueOnError: true,
      shouldShowNotice: false
    });

    assertNonNullable(capturedProgressEl);
    expect((capturedProgressEl as HTMLProgressElement).value).toBe(2);

    vi.mocked(console.error).mockRestore();
    createElementSpy.mockRestore();
  });

  it('should work with a single item', async () => {
    const processItem = vi.fn();
    const buildNoticeMessage = vi.fn(() => 'single');

    await loop({
      buildNoticeMessage,
      items: ['only'],
      pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
      processItem,
      shouldShowNotice: false
    });

    expect(processItem).toHaveBeenCalledTimes(1);
    expect(processItem).toHaveBeenCalledWith('only');
    expect(buildNoticeMessage).toHaveBeenCalledWith({ item: 'only', iterationString: '# 1 / 1' });
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
      pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
      processItem: vi.fn(),
      shouldShowNotice: false
    });

    expect(requestAnimationFrameAsync).toHaveBeenCalled();
    vi.mocked(performance.now).mockRestore();
  });

  it('should show the progress bar through a delayed notice and dispose it when the loop completes', async () => {
    const fake = createFakePluginNoticeComponent();
    const contents: (DocumentFragment | string)[] = [];

    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a', 'b'],
      pluginNoticeComponent: fake.pluginNoticeComponent,
      processItem: async (item) => {
        if (item === 'a') {
          contents.push(await resolveNoticeContent(fake));
        }
      },
      progressBarTitle: 'My Progress'
    });

    expect(fake.showNoticeAfterDelay).toHaveBeenCalledWith(expect.objectContaining({ delayInMilliseconds: 500 }));
    expect(contents).toHaveLength(1);
    const fragment = castTo<DocumentFragment>(contents[0]);
    expect(fragment.textContent).toBe('My Progress');
    expect(fragment.querySelector('progress')).not.toBeNull();
    // The progress bar reports the current state, so the lazily built content never needs replacing.
    expect(fake.setContent).not.toHaveBeenCalled();
    expect(fake.dispose).toHaveBeenCalledTimes(1);
  });

  it('should update the notice with each message once it is shown when shouldShowProgressBar is false', async () => {
    const fake = createFakePluginNoticeComponent();
    const contents: (DocumentFragment | string)[] = [];

    await loop({
      buildNoticeMessage: vi.fn((params: LoopBuildNoticeMessageParams<string>) => `msg ${params.item}`),
      items: ['a', 'b', 'c'],
      pluginNoticeComponent: fake.pluginNoticeComponent,
      processItem: async (item) => {
        if (item === 'b') {
          contents.push(await resolveNoticeContent(fake));
        }
      },
      shouldShowProgressBar: false
    });

    // Before the delay elapses there is no notice to update: the content provider picks up the latest message.
    expect(contents).toEqual(['msg b']);
    expect(fake.setContent.mock.calls).toEqual([['msg c']]);
    expect(fake.dispose).toHaveBeenCalledTimes(1);
  });

  it('should dispose the notice when the loop is aborted', async () => {
    const fake = createFakePluginNoticeComponent();
    const controller = new AbortController();

    await loop({
      abortSignal: controller.signal,
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a', 'b'],
      pluginNoticeComponent: fake.pluginNoticeComponent,
      processItem: () => {
        controller.abort();
      }
    });

    expect(fake.dispose).toHaveBeenCalledTimes(1);
  });

  it('should dispose the notice when the loop fails', async () => {
    const fake = createFakePluginNoticeComponent();

    vi.spyOn(console, 'error').mockImplementation(() => {
      noop();
    });

    await expect(loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a'],
      pluginNoticeComponent: fake.pluginNoticeComponent,
      processItem: vi.fn().mockRejectedValue(new Error('fail')),
      shouldContinueOnError: false
    })).rejects.toThrow('loop failed');

    expect(fake.dispose).toHaveBeenCalledTimes(1);
  });

  it('should not show a notice when pluginNoticeComponent is null', async () => {
    const processItem = vi.fn();

    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a', 'b'],
      pluginNoticeComponent: null,
      processItem,
      shouldShowProgressBar: false
    });

    expect(processItem).toHaveBeenCalledTimes(2);
  });

  it('should keep the progress notice on screen for a run that outlasts the default notice duration', async () => {
    vi.useFakeTimers();
    const pluginNoticeComponent = new PluginNoticeComponent({
      app: App.createConfigured__().asOriginalType__(),
      pluginName: 'Plugin'
    });
    const noticeConstructorSpy = vi.spyOn(Notice.prototype, 'constructor__');
    const hideSpy = vi.spyOn(Notice.prototype, 'hide');
    const LONGER_THAN_DEFAULT_NOTICE_DURATION_IN_MILLISECONDS = 10_000;

    await loop({
      buildNoticeMessage: vi.fn(() => 'msg'),
      items: ['a', 'b'],
      pluginNoticeComponent,
      processItem: async () => {
        await vi.advanceTimersByTimeAsync(LONGER_THAN_DEFAULT_NOTICE_DURATION_IN_MILLISECONDS);
        // The notice must still be up while the loop runs.
        expect(hideSpy).not.toHaveBeenCalled();
      }
    });

    expect(noticeConstructorSpy).toHaveBeenCalledTimes(1);
    // The argument, not `duration__`: the mock records an omitted duration as 0, which would hide the defect. A zero
    // duration is Obsidian's never-auto-hide form; omitted, the notice vanishes a few seconds into the run.
    expect(noticeConstructorSpy.mock.calls[0]?.[1]).toBe(0);
    expect(hideSpy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
