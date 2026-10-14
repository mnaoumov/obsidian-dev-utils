import {
  invokeAsyncSafely,
  neverEnds,
  sleep
} from '@mnaoumov/typescript-lib/async';
import {
  ASYNC_OPERATION_HOOK_VERSION,
  getAsyncOperationHook,
  setAsyncOperationHook
} from '@mnaoumov/typescript-lib/async-operation-hook';
import { dispose } from '@mnaoumov/typescript-lib/disposable';
import {
  noop,
  noopAsync
} from '@mnaoumov/typescript-lib/function';
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
  isAsyncOperationTrackingEnabled,
  waitForAllAsyncOperations
} from './async-operation-tracking.ts';

describe('async operation tracking', () => {
  afterEach(() => {
    disableAsyncOperationTracking();
    setAsyncOperationHook(null);
  });

  it('should wait for tracked fire-and-forget operations to settle', async () => {
    enableAsyncOperationTracking();
    let didComplete = false;
    invokeAsyncSafely(async () => {
      await noopAsync();
      didComplete = true;
    });

    await waitForAllAsyncOperations();

    expect(didComplete).toBe(true);
  });

  it('should drain operations scheduled while waiting', async () => {
    enableAsyncOperationTracking();
    let completedCount = 0;
    invokeAsyncSafely(async () => {
      await noopAsync();
      completedCount++;
      invokeAsyncSafely(async () => {
        await noopAsync();
        completedCount++;
      });
    });

    await waitForAllAsyncOperations();

    const EXPECTED_COMPLETED_COUNT = 2;
    expect(completedCount).toBe(EXPECTED_COMPLETED_COUNT);
  });

  it('should throw when tracking is disabled instead of silently resolving', async () => {
    disableAsyncOperationTracking();
    await expect(waitForAllAsyncOperations()).rejects.toThrow('Async operation tracking is not enabled');
  });

  it('should disable tracking when the returned disposable is disposed', async () => {
    const disposable = enableAsyncOperationTracking();
    dispose(disposable);
    await expect(waitForAllAsyncOperations()).rejects.toThrow('Async operation tracking is not enabled');
  });

  it('should keep tracking enabled inside a using scope and disable it on exit', async () => {
    {
      using _tracking = enableAsyncOperationTracking();
      await expect(waitForAllAsyncOperations()).resolves.toBeUndefined();
    }
    await expect(waitForAllAsyncOperations()).rejects.toThrow('Async operation tracking is not enabled');
  });

  it('should report whether tracking is currently enabled', () => {
    disableAsyncOperationTracking();
    expect(isAsyncOperationTrackingEnabled()).toBe(false);

    enableAsyncOperationTracking();
    expect(isAsyncOperationTrackingEnabled()).toBe(true);

    disableAsyncOperationTracking();
    expect(isAsyncOperationTrackingEnabled()).toBe(false);
  });

  it('should install the hook production code reports to, and remove it again', () => {
    disableAsyncOperationTracking();
    expect(getAsyncOperationHook()).toBeNull();

    enableAsyncOperationTracking();
    expect(getAsyncOperationHook()?.version).toBe(ASYNC_OPERATION_HOOK_VERSION);

    disableAsyncOperationTracking();
    expect(getAsyncOperationHook()).toBeNull();
  });

  it('should keep the operations already recorded when enabled twice', async () => {
    enableAsyncOperationTracking();
    let didComplete = false;
    invokeAsyncSafely(async () => {
      await sleep({ milliseconds: 0 });
      didComplete = true;
    });

    enableAsyncOperationTracking();
    await waitForAllAsyncOperations();

    expect(didComplete).toBe(true);
  });

  it('should leave a hook it did not install alone', () => {
    disableAsyncOperationTracking();
    const foreignHook = { onAsyncOperationStarted: vi.fn(), version: ASYNC_OPERATION_HOOK_VERSION };
    setAsyncOperationHook(foreignHook);

    expect(isAsyncOperationTrackingEnabled()).toBe(false);
    disableAsyncOperationTracking();

    expect(getAsyncOperationHook()).toBe(foreignHook);
  });

  it('should replace a hook it did not install when enabled', () => {
    disableAsyncOperationTracking();
    setAsyncOperationHook({ onAsyncOperationStarted: noop, version: ASYNC_OPERATION_HOOK_VERSION });

    enableAsyncOperationTracking();

    expect(isAsyncOperationTrackingEnabled()).toBe(true);
  });

  it('should leave tracking off in freshly loaded modules, so production code carries no bookkeeping', async () => {
    disableAsyncOperationTracking();
    vi.resetModules();
    const freshTrackingModule = await import('./async-operation-tracking.ts');
    const freshHookModule = await import('@mnaoumov/typescript-lib/async-operation-hook');
    await import('@mnaoumov/typescript-lib/async');

    expect(freshTrackingModule.isAsyncOperationTrackingEnabled()).toBe(false);
    expect(freshHookModule.getAsyncOperationHook()).toBeNull();
  });

  // The code under test and the test support can each bundle their own copy of the generic code. The hook slot is
  // global precisely so that the copy the tests enable tracking through is the copy the code under test reports to.
  it('should track operations a second loaded copy of the library schedules', async () => {
    enableAsyncOperationTracking();
    vi.resetModules();
    const secondCopy = await import('@mnaoumov/typescript-lib/async');
    expect(secondCopy.invokeAsyncSafely).not.toBe(invokeAsyncSafely);

    let didComplete = false;
    secondCopy.invokeAsyncSafely(async () => {
      await sleep({ milliseconds: 0 });
      didComplete = true;
    });
    await waitForAllAsyncOperations();

    expect(didComplete).toBe(true);
  });

  it('should drain through a second loaded copy of the tracking module', async () => {
    enableAsyncOperationTracking();
    let didComplete = false;
    invokeAsyncSafely(async () => {
      await sleep({ milliseconds: 0 });
      didComplete = true;
    });

    vi.resetModules();
    const secondCopy = await import('./async-operation-tracking.ts');
    expect(secondCopy.isAsyncOperationTrackingEnabled()).toBe(true);
    await secondCopy.waitForAllAsyncOperations();

    expect(didComplete).toBe(true);
  });

  it('should forget operations pending when tracking was disabled, and not record ones scheduled while it was off', async () => {
    enableAsyncOperationTracking();
    invokeAsyncSafely(neverEnds);
    disableAsyncOperationTracking();
    invokeAsyncSafely(neverEnds);
    enableAsyncOperationTracking();

    const PENDING_GRACE_IN_MILLISECONDS = 100;
    const outcome = await Promise.race([
      waitForAllAsyncOperations().then(() => 'drained'),
      sleep({ milliseconds: PENDING_GRACE_IN_MILLISECONDS }).then(() => 'still pending')
    ]);
    expect(outcome).toBe('drained');
  });
});
