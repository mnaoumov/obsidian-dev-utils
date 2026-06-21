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
 */

import type { GenericObject } from './type-guards.ts';

import { ValueWrapper } from './value-wrapper.ts';

interface ObsidianDevUtilsWrapper {
  __obsidianDevUtils: GenericObject;
}

/**
 * Retrieves or creates a shared-state {@link ValueWrapper} for a given key on `globalThis.__obsidianDevUtils`.
 *
 * @typeParam T - The type of the shared state value.
 * @param key - The key to store or retrieve the shared state under.
 * @param defaultValue - The default value to use if the shared state does not exist yet.
 * @returns The {@link ValueWrapper} that stores the shared state.
 */
export function getObsidianDevUtilsState<T>(key: string, defaultValue: T): ValueWrapper<T> {
  // eslint-disable-next-line obsidianmd/no-global-this -- The shared state intentionally lives on the realm global.
  const wrapper = globalThis as Partial<ObsidianDevUtilsWrapper>;
  wrapper.__obsidianDevUtils ??= {};
  return (wrapper.__obsidianDevUtils[key] ??= ValueWrapper.of(defaultValue)) as ValueWrapper<T>;
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
