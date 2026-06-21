import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  disableAsyncOperationTracking,
  enableAsyncOperationTracking,
  waitForAllAsyncOperations
} from '../async.ts';
import { setupAsyncOperationTracking } from './async-operation-tracking-setup.ts';

describe('setupAsyncOperationTracking', () => {
  afterEach(() => {
    disableAsyncOperationTracking();
  });

  it('should register the tracking toggles with the provided hooks', () => {
    const beforeEachRegistrar = vi.fn<(fn: () => void) => void>();
    const afterEachRegistrar = vi.fn<(fn: () => void) => void>();

    setupAsyncOperationTracking({
      afterEach: afterEachRegistrar,
      beforeEach: beforeEachRegistrar
    });

    expect(beforeEachRegistrar).toHaveBeenCalledTimes(1);
    expect(beforeEachRegistrar).toHaveBeenCalledWith(enableAsyncOperationTracking);
    expect(afterEachRegistrar).toHaveBeenCalledTimes(1);
    expect(afterEachRegistrar).toHaveBeenCalledWith(disableAsyncOperationTracking);
  });

  it('should enable tracking via the beforeEach callback and disable it via the afterEach callback', async () => {
    let beforeEachCallback: (() => void) | undefined;
    let afterEachCallback: (() => void) | undefined;

    const beforeEachRegistrar = vi.fn<(fn: () => void) => void>((fn) => {
      beforeEachCallback = fn;
    });
    const afterEachRegistrar = vi.fn<(fn: () => void) => void>((fn) => {
      afterEachCallback = fn;
    });

    setupAsyncOperationTracking({
      afterEach: afterEachRegistrar,
      beforeEach: beforeEachRegistrar
    });

    expect(beforeEachCallback).toBeDefined();
    expect(afterEachCallback).toBeDefined();

    beforeEachCallback?.();
    await expect(waitForAllAsyncOperations()).resolves.toBeUndefined();

    afterEachCallback?.();
    await expect(waitForAllAsyncOperations()).rejects.toThrow('Async operation tracking is not enabled');
  });
});
