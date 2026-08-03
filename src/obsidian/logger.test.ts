import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { noopAsync } from '../function.ts';
import { invokeAsyncAndLog } from './logger.ts';

vi.mock('../debug.ts', () => ({
  getLibDebugger: vi.fn(() => vi.fn()),
  printWithStackTrace: vi.fn()
}));

vi.mock('../error.ts', async (importOriginal) => {
  const $module = await importOriginal<typeof import('../error.ts')>();
  return {
    ...$module,
    getStackTrace: vi.fn(() => 'mock stack trace')
  };
});

describe('invokeAsyncAndLog', () => {
  it('should invoke the function and resolve', async () => {
    const $function = vi.fn();
    const controller = new AbortController();
    await invokeAsyncAndLog({ $function, abortSignal: controller.signal, title: 'test' });
    expect($function).toHaveBeenCalledTimes(1);
    expect($function).toHaveBeenCalledWith(controller.signal);
  });

  it('should throw immediately if already aborted', async () => {
    const $function = vi.fn();
    const controller = new AbortController();
    controller.abort('cancelled');
    await expect(invokeAsyncAndLog({ $function, abortSignal: controller.signal, title: 'test' })).rejects.toThrow();
    expect($function).not.toHaveBeenCalled();
  });

  it('should rethrow errors from the function', async () => {
    const $function = vi.fn().mockRejectedValue(new Error('task failed'));
    const controller = new AbortController();
    await expect(invokeAsyncAndLog({ $function, abortSignal: controller.signal, title: 'test' })).rejects.toThrow('task failed');
  });

  it('should throw if aborted during execution', async () => {
    const controller = new AbortController();
    const $function = vi.fn(async (): Promise<void> => {
      await noopAsync();
      controller.abort('mid-execution');
    });
    await expect(invokeAsyncAndLog({ $function, abortSignal: controller.signal, title: 'test' })).rejects.toThrow();
  });

  it('should use provided stack trace', async () => {
    const $function = vi.fn();
    const controller = new AbortController();
    await invokeAsyncAndLog({ $function, abortSignal: controller.signal, stackTrace: 'custom stack', title: 'test' });
    expect($function).toHaveBeenCalledTimes(1);
  });
});
