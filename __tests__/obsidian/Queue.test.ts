import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { noop } from '../../src/Function.ts';
import {
  addToQueue,
  addToQueueAndWait,
  flushQueue
} from '../../src/obsidian/Queue.ts';

const mocks = vi.hoisted(() => ({
  addErrorHandler: vi.fn(async (fn: () => Promise<void>) => {
    await fn();
  }),
  getObsidianDevUtilsState: vi.fn(),
  invokeAsyncAndLog: vi.fn(async (_name: string, fn: (signal: AbortSignal) => Promise<void>, signal: AbortSignal) => {
    await fn(signal);
  }),
  invokeAsyncSafely: vi.fn((fn: () => Promise<unknown>) => {
    fn().catch(() => undefined);
  }),
  runWithTimeoutNotice: vi.fn(async (options: { operationFn: (signal: AbortSignal) => Promise<void> }) => {
    const controller = new AbortController();
    await options.operationFn(controller.signal);
  })
}));

vi.mock('../../src/AbortController.ts', () => ({
  abortSignalAny: vi.fn((...signals: AbortSignal[]) => signals[0]),
  abortSignalNever: vi.fn(() => new AbortController().signal)
}));

vi.mock('../../src/Async.ts', () => ({
  addErrorHandler: mocks.addErrorHandler,
  invokeAsyncSafely: mocks.invokeAsyncSafely
}));

vi.mock('../../src/Error.ts', () => ({
  getStackTrace: vi.fn(() => 'mock-stack-trace')
}));

vi.mock('../../src/Function.ts', () => ({
  noop: vi.fn()
}));

vi.mock('../../src/obsidian/App.ts', () => ({
  getObsidianDevUtilsState: mocks.getObsidianDevUtilsState
}));

vi.mock('../../src/obsidian/AsyncWithNotice.ts', () => ({
  runWithTimeoutNotice: mocks.runWithTimeoutNotice
}));

vi.mock('../../src/obsidian/i18n/i18n.ts', () => ({
  t: vi.fn((selector: unknown) => {
    if (typeof selector === 'function') {
      const proxy: unknown = new Proxy({}, { get: (): unknown => proxy });
      (selector as (root: unknown) => unknown)(proxy);
    }
    return 'mock-translation';
  })
}));

vi.mock('../../src/obsidian/Logger.ts', () => ({
  invokeAsyncAndLog: mocks.invokeAsyncAndLog
}));

interface MockQueue {
  items: unknown[];
  promise: Promise<void>;
}

function createMockQueue(): MockQueue {
  return { items: [], promise: Promise.resolve() };
}

describe('addToQueue', () => {
  let queue: MockQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    queue = createMockQueue();
    mocks.getObsidianDevUtilsState.mockReturnValue({ value: queue });
  });

  it('should add an item to the queue via invokeAsyncSafely', () => {
    const operationFn = vi.fn();
    addToQueue({ app: {} as never, operationFn, operationName: 'test-op' });
    expect(mocks.invokeAsyncSafely).toHaveBeenCalledWith(expect.any(Function), 'mock-stack-trace');
  });
});

describe('addToQueueAndWait', () => {
  let queue: MockQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    queue = createMockQueue();
    mocks.getObsidianDevUtilsState.mockReturnValue({ value: queue });
  });

  it('should add an item to the queue and process it', async () => {
    const operationFn = vi.fn();
    await addToQueueAndWait({ app: {} as never, operationFn, operationName: 'test-op' });
    expect(queue.items.length).toBe(0);
    expect(mocks.runWithTimeoutNotice).toHaveBeenCalled();
  });

  it('should process operations in order', async () => {
    const order: number[] = [];
    const op1 = vi.fn(() => {
      order.push(1);
    });
    const op2 = vi.fn(() => {
      order.push(2);
    });

    await addToQueueAndWait({ app: {} as never, operationFn: op1, operationName: 'op1' });
    await addToQueueAndWait({ app: {} as never, operationFn: op2, operationName: 'op2' });
    expect(order).toEqual([1, 2]);
  });

  it('should throw when abort signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(addToQueueAndWait({
      abortSignal: controller.signal,
      app: {} as never,
      operationFn: vi.fn()
    })).rejects.toThrow();
  });

  it('should use default timeout when not specified', async () => {
    await addToQueueAndWait({ app: {} as never, operationFn: vi.fn() });
    expect(mocks.runWithTimeoutNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        timeoutInMilliseconds: 60000
      })
    );
  });

  it('should use custom timeout when specified', async () => {
    await addToQueueAndWait({ app: {} as never, operationFn: vi.fn(), timeoutInMilliseconds: 5000 });
    expect(mocks.runWithTimeoutNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        timeoutInMilliseconds: 5000
      })
    );
  });

  it('should use custom stack trace when provided', async () => {
    await addToQueueAndWait({ app: {} as never, operationFn: vi.fn(), stackTrace: 'custom-stack' });
    expect(mocks.runWithTimeoutNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        stackTrace: 'custom-stack'
      })
    );
  });

  it('should handle empty queue gracefully', async () => {
    // Queue with no items should just resolve
    queue.items = [];
    await addToQueueAndWait({ app: {} as never, operationFn: noop });
    expect(mocks.runWithTimeoutNotice).toHaveBeenCalled();
  });
});

describe('flushQueue', () => {
  let queue: MockQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    queue = createMockQueue();
    mocks.getObsidianDevUtilsState.mockReturnValue({ value: queue });
  });

  it('should add a noop operation to the queue', async () => {
    await flushQueue({} as never);
    expect(mocks.runWithTimeoutNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        operationName: 'mock-translation'
      })
    );
  });
});
