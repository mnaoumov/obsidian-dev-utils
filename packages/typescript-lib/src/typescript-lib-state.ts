/**
 * @file
 *
 * Provides access to the process-wide shared-state bag of the generic, non-Obsidian part of the library.
 *
 * The bag lives on `globalThis` under a `Symbol.for` key, so every copy of this module loaded in one realm shares
 * it, whichever version it is. It holds what must exist once per realm: the debuggers, the `debug` instance and the
 * shared abort controller. Obsidian-specific state stays in `obsidian-dev-utils-state.ts`.
 *
 * The slot is a cross-version wire format: its key and the {@link TypescriptLibStateSlot} shape only ever change
 * additively.
 */

import { ValueWrapper } from './value-wrapper.ts';

/**
 * The version of the {@link TypescriptLibStateSlot} shape this copy writes.
 */
export const TYPESCRIPT_LIB_STATE_VERSION = 1;

/**
 * The key of the global slot holding the {@link TypescriptLibStateSlot}.
 */
export const TYPESCRIPT_LIB_STATE_KEY: unique symbol = Symbol.for('@mnaoumov/typescript-lib/state');

/**
 * The shared-state slot stored on `globalThis`.
 */
export interface TypescriptLibStateSlot {
  /**
   * The shared values, each in a {@link ValueWrapper} so a holder can replace the value in place.
   */
  readonly values: Record<string, ValueWrapper>;

  /**
   * The version of the slot shape the creator wrote. Informational: the shape only changes additively.
   */
  readonly version: number;
}

type GlobalWithTypescriptLibState = Partial<Record<typeof TYPESCRIPT_LIB_STATE_KEY, TypescriptLibStateSlot>>;

/**
 * Retrieves or creates a shared-state {@link ValueWrapper} for a given key.
 *
 * @typeParam T - The type of the shared state value.
 * @param key - The key to store or retrieve the shared state under.
 * @param defaultValue - The default value to use if the shared state does not exist yet.
 * @returns The {@link ValueWrapper} that stores the shared state.
 */
export function getTypescriptLibState<T>(key: string, defaultValue: T): ValueWrapper<T> {
  return (getTypescriptLibStateSlot().values[key] ??= ValueWrapper.of(defaultValue)) as ValueWrapper<T>;
}

/**
 * Retrieves or creates the shared-state slot.
 *
 * @returns The {@link TypescriptLibStateSlot}.
 */
export function getTypescriptLibStateSlot(): TypescriptLibStateSlot {
  const global = getGlobal();
  let slot = global[TYPESCRIPT_LIB_STATE_KEY];
  if (!slot) {
    slot = createSlot();
    global[TYPESCRIPT_LIB_STATE_KEY] = slot;
  }
  return slot;
}

/**
 * Clears the shared-state bag.
 *
 * Intended for test isolation: call it before each test so accumulated state does not leak between tests.
 */
export function resetTypescriptLibState(): void {
  getGlobal()[TYPESCRIPT_LIB_STATE_KEY] = createSlot();
}

function createSlot(): TypescriptLibStateSlot {
  return {
    values: {},
    version: TYPESCRIPT_LIB_STATE_VERSION
  };
}

function getGlobal(): GlobalWithTypescriptLibState {
  // eslint-disable-next-line obsidianmd/no-global-this -- The shared state intentionally lives on the realm global.
  return globalThis as GlobalWithTypescriptLibState;
}
