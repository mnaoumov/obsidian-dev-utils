import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { invokeAsyncAndLog } from './logger.ts';

vi.mock('../debug.ts', () => ({
  getLibDebugger: vi.fn(() => vi.fn()),
  printWithStackTrace: vi.fn()
}));

vi.mock('../error.ts', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../error.ts')>();
  return {
    ...mod,
    getStackTrace: vi.fn(() => 'mock stack trace')
  };
});

describe('invokeAsyncAndLog', () => {
  it('should invoke the function and resolve', async () => {
    const fn = vi.fn();
    const controller = new AbortController();
    await invokeAsyncAndLog('test', fn, controller.signal);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(controller.signal);
  });

  it('should throw immediately if already aborted', async () => {
    const fn = vi.fn();
    const controller = new AbortController();
    controller.abort('cancelled');
    await expect(invokeAsyncAndLog('test', fn, controller.signal)).rejects.toThrow();
    expect(fn).not.toHaveBeenCalled();
  });

  it('should rethrow errors from the function', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('task failed'));
    const controller = new AbortController();
    await expect(invokeAsyncAndLog('test', fn, controller.signal)).rejects.toThrow('task failed');
  });

  it('should throw if aborted during execution', async () => {
    const controller = new AbortController();
    const fn = vi.fn(async (): Promise<void> => {
      controller.abort('mid-execution');
    });
    await expect(invokeAsyncAndLog('test', fn, controller.signal)).rejects.toThrow();
  });

  it('should use provided stack trace', async () => {
    const fn = vi.fn();
    const controller = new AbortController();
    await invokeAsyncAndLog('test', fn, controller.signal, 'custom stack');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
