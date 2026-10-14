/**
 * @file
 *
 * An optional observer that fire-and-forget operations report to when they start.
 *
 * Production code only ever CALLS the hook: {@link notifyAsyncOperationStarted} is a no-op until something
 * installs one, so no bookkeeping is kept when nothing is listening. The test support
 * (`async-operation-tracking.ts`) is what installs it, and it owns the registry of pending operations.
 *
 * The slot lives on `globalThis` under a `Symbol.for` key rather than in a module-level variable. Two
 * installed copies of this module — the code under test bundling one version, the test support depending on
 * another — then still share one slot, so the hook the tests install is the hook the code under test calls.
 * A module-level variable would let each copy keep its own, and tracking would silently see nothing.
 *
 * The slot is a cross-version wire format: its key and the members of {@link AsyncOperationHook} only ever
 * change additively.
 */

/**
 * The version of the {@link AsyncOperationHook} shape this copy writes.
 */
export const ASYNC_OPERATION_HOOK_VERSION = 1;

/**
 * The key of the global slot holding the installed {@link AsyncOperationHook}.
 */
export const ASYNC_OPERATION_HOOK_KEY: unique symbol = Symbol.for('@mnaoumov/typescript-lib/async-operation-hook');

/**
 * An observer notified whenever a fire-and-forget operation starts.
 */
export interface AsyncOperationHook {
  /**
   * Called with each fire-and-forget operation as it starts.
   *
   * @param operation - The operation. It never rejects: errors are already handled before it is reported.
   */
  readonly onAsyncOperationStarted: (operation: Promise<void>) => void;

  /**
   * The version of the hook shape the installer wrote. Informational: the members only change additively.
   */
  readonly version: number;
}

type AsyncOperationHookSlot = Partial<Record<typeof ASYNC_OPERATION_HOOK_KEY, AsyncOperationHook | null>>;

/**
 * Gets the installed {@link AsyncOperationHook}.
 *
 * @returns The installed hook, or `null` when none is installed.
 */
export function getAsyncOperationHook(): AsyncOperationHook | null {
  return getSlot()[ASYNC_OPERATION_HOOK_KEY] ?? null;
}

/**
 * Reports a fire-and-forget operation to the installed {@link AsyncOperationHook}, if any.
 *
 * @param operation - The operation that has just started.
 */
export function notifyAsyncOperationStarted(operation: Promise<void>): void {
  getAsyncOperationHook()?.onAsyncOperationStarted(operation);
}

/**
 * Installs an {@link AsyncOperationHook}, replacing any installed one, or removes it.
 *
 * @param hook - The hook to install, or `null` to remove the installed one.
 */
export function setAsyncOperationHook(hook: AsyncOperationHook | null): void {
  getSlot()[ASYNC_OPERATION_HOOK_KEY] = hook;
}

function getSlot(): AsyncOperationHookSlot {
  // eslint-disable-next-line obsidianmd/no-global-this -- The hook slot intentionally lives on the realm global, shared by every copy of this module.
  return globalThis as AsyncOperationHookSlot;
}
