/**
 * @file
 *
 * Provides access to a process-wide shared-state bag used internally by `obsidian-dev-utils`.
 *
 * The bag is stored on `globalThis.__obsidianDevUtils`, i.e. on the global object of the realm in
 * which `obsidian-dev-utils` is loaded. Because a function's `globalThis` resolves to its defining
 * realm (not the caller's), every consumer that bundles the library in the main Obsidian renderer
 * shares the same bag, regardless of which window is currently active. This intentionally replaces
 * the previous `App`-scoped storage, so callers no longer need to pass an `App` instance.
 *
 * The generic, non-Obsidian state (the debuggers, the `debug` instance and the shared abort controller) lives in
 * `typescript-lib-state.ts` instead. {@link shareTypescriptLibStateWithObsidianDevUtilsState} links the two, so
 * plugins bundling an older copy of this library, which still keep that state here, share it with newer ones.
 */

import type { GenericObject } from './type-guards.ts';

import { getTypescriptLibStateSlot } from './typescript-lib-state.ts';
import { ValueWrapper } from './value-wrapper.ts';

interface ObsidianDevUtilsWrapper {
  __obsidianDevUtils: GenericObject;
}

/**
 * The keys whose state moved from `__obsidianDevUtils` to the generic shared state, and which older copies of
 * this library still keep under `__obsidianDevUtils`.
 */
const SHARED_WITH_TYPESCRIPT_LIB_STATE_KEYS = ['debug', 'debuggers', 'sharedAbortController'] as const;

/**
 * Retrieves or creates a shared-state {@link ValueWrapper} for a given key on `globalThis.__obsidianDevUtils`.
 *
 * @typeParam T - The type of the shared state value.
 * @param key - The key to store or retrieve the shared state under.
 * @param defaultValue - The default value to use if the shared state does not exist yet.
 * @returns The {@link ValueWrapper} that stores the shared state.
 */
export function getObsidianDevUtilsState<T>(key: string, defaultValue: T): ValueWrapper<T> {
  return (getObsidianDevUtilsBag()[key] ??= ValueWrapper.of(defaultValue)) as ValueWrapper<T>;
}

/**
 * Clears the shared-state bag on `globalThis.__obsidianDevUtils`.
 *
 * Intended for test isolation: call it before each test so accumulated state (debuggers, queues,
 * registered handlers, etc.) does not leak between tests.
 */
export function resetObsidianDevUtilsState(): void {
  // eslint-disable-next-line obsidianmd/no-global-this -- The shared state intentionally lives on the realm global.
  (globalThis as Partial<ObsidianDevUtilsWrapper>).__obsidianDevUtils = {};
}

/**
 * Makes the generic shared state and `__obsidianDevUtils` hold the same {@link ValueWrapper} for each key that
 * moved between them.
 *
 * A wrapper already under `__obsidianDevUtils` wins, because an older copy of this library loaded first and its
 * callers already hold that instance. Otherwise the generic wrapper is published under `__obsidianDevUtils`, for
 * older copies loaded later and for the devtools console.
 */
export function shareTypescriptLibStateWithObsidianDevUtilsState(): void {
  const bag = getObsidianDevUtilsBag();
  const values = getTypescriptLibStateSlot().values;
  for (const key of SHARED_WITH_TYPESCRIPT_LIB_STATE_KEYS) {
    const legacyWrapper = bag[key] as undefined | ValueWrapper;
    if (legacyWrapper) {
      values[key] = legacyWrapper;
      continue;
    }

    const wrapper = values[key];
    if (wrapper) {
      bag[key] = wrapper;
    }
  }
}

function getObsidianDevUtilsBag(): GenericObject {
  // eslint-disable-next-line obsidianmd/no-global-this -- The shared state intentionally lives on the realm global.
  const wrapper = globalThis as Partial<ObsidianDevUtilsWrapper>;
  wrapper.__obsidianDevUtils ??= {};
  return wrapper.__obsidianDevUtils;
}
