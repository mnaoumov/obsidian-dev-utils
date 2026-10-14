/**
 * @file
 *
 * Test support: records fire-and-forget operations so a test can await them all.
 *
 * It works by installing the {@link AsyncOperationHook} that production code reports to, so production
 * code itself keeps no registry. The pending operations live on the installed hook, not in this module, so a
 * second copy of this module reads the same registry the first one installed.
 */

import type { AsyncOperationHook } from './async-operation-hook.ts';

import { snapshot } from './array.ts';
import {
  ASYNC_OPERATION_HOOK_VERSION,
  getAsyncOperationHook,
  setAsyncOperationHook
} from './async-operation-hook.ts';
import { CallbackDisposable } from './disposable.ts';

interface TrackingAsyncOperationHook extends AsyncOperationHook {
  readonly pendingAsyncOperations: Set<Promise<void>>;
}

/**
 * Disables tracking previously enabled via {@link enableAsyncOperationTracking} and forgets any currently-tracked operations.
 */
export function disableAsyncOperationTracking(): void {
  const hook = getTrackingHook();
  if (!hook) {
    return;
  }

  hook.pendingAsyncOperations.clear();
  setAsyncOperationHook(null);
}

/**
 * Enables tracking of fire-and-forget operations scheduled via `invokeAsyncSafely` (and therefore `convertAsyncToSync`).
 *
 * While enabled, each scheduled operation is recorded until it settles so that tests can await them all via {@link waitForAllAsyncOperations}, removing the need to override `invokeAsyncSafely` / `convertAsyncToSync` in tests.
 *
 * Tracking is disabled by default, so production code carries no bookkeeping overhead. Intended to be enabled in test environments only.
 * Enabling it while it is already enabled keeps the operations already recorded.
 *
 * @returns A {@link Disposable} that disables tracking again (via {@link disableAsyncOperationTracking}) when disposed, for use with `using`.
 */
export function enableAsyncOperationTracking(): Disposable {
  if (!getTrackingHook()) {
    const pendingAsyncOperations = new Set<Promise<void>>();
    const hook: TrackingAsyncOperationHook = {
      onAsyncOperationStarted(operation: Promise<void>): void {
        pendingAsyncOperations.add(operation);
        // eslint-disable-next-line no-void -- Fire-and-forget cleanup of the settled operation.
        void operation.finally(() => {
          pendingAsyncOperations.delete(operation);
        });
      },
      pendingAsyncOperations,
      version: ASYNC_OPERATION_HOOK_VERSION
    };
    setAsyncOperationHook(hook);
  }

  return new CallbackDisposable({
    callback: disableAsyncOperationTracking
  });
}

/**
 * Checks whether async-operation tracking is currently enabled (see {@link enableAsyncOperationTracking}).
 *
 * @returns `true` if tracking is enabled, `false` otherwise.
 */
export function isAsyncOperationTrackingEnabled(): boolean {
  return getTrackingHook() !== null;
}

/**
 * Waits for all fire-and-forget operations tracked since {@link enableAsyncOperationTracking} was called to settle.
 *
 * Operations scheduled while awaiting are also awaited, so cascading fire-and-forget chains are fully drained.
 *
 * @returns A {@link Promise} that resolves once no tracked operations remain pending.
 * @throws If tracking is not enabled. Otherwise this would silently resolve as if all operations were finished, masking a missing {@link enableAsyncOperationTracking} call.
 */
export async function waitForAllAsyncOperations(): Promise<void> {
  const hook = getTrackingHook();
  if (!hook) {
    throw new Error('Async operation tracking is not enabled. Call enableAsyncOperationTracking() before waitForAllAsyncOperations().');
  }

  while (hook.pendingAsyncOperations.size > 0) {
    await Promise.allSettled(snapshot(hook.pendingAsyncOperations));
  }
}

function getTrackingHook(): null | TrackingAsyncOperationHook {
  const hook = getAsyncOperationHook();
  return hook && 'pendingAsyncOperations' in hook ? hook as TrackingAsyncOperationHook : null;
}
