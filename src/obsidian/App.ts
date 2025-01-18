/**
 * @packageDocumentation App
 * Provides a utility to retrieve the Obsidian `App` instance.
 */

import type { App } from 'obsidian';

import { throwExpression } from '../Error.ts';

/**
 * Wrapper type for accessing the `App` instance globally.
 */
interface AppWrapper {
  /**
   * An optional reference to the Obsidian `App` instance.
   */
  app: App;
}

interface ObsidianDevUtilsStateWrapper {
  obsidianDevUtilsState: Record<string, unknown>;
}

/**
 * Wrapper type for storing shared state in the Obsidian app.
 */
export class ValueWrapper<T> {
  public constructor(public value: T) { }
}

/**
 * Retrieves the Obsidian `App` instance.
 *
 * @returns The `App` instance.
 * @throws Will throw an error if the `App` instance cannot be found.
 *
 * @see {@link https://github.com/mnaoumov/obsidian-codescript-toolkit?tab=readme-ov-file#obsidianapp-module}
 */
export function getApp(): App {
  try {
    return globalThis.require('obsidian/app') as App;
  } catch {
    return (globalThis as Partial<AppWrapper>).app ?? throwExpression(new Error('Obsidian app not found'));
  }
}

/**
 * Retrieves or creates a shared state wrapper object for a given key in the Obsidian app.
 *
 * @param app - The Obsidian app instance.
 * @param key - The key to store or retrieve the shared state.
 * @param defaultValue - The default value to use if the shared state does not exist.
 * @returns The ValueWrapper object that stores the shared state.
 */
export function getObsidianDevUtilsState<T>(app: App, key: string, defaultValue: T): ValueWrapper<T> {
  const sharedStateWrapper = app as Partial<ObsidianDevUtilsStateWrapper>;
  const sharedState = sharedStateWrapper.obsidianDevUtilsState ??= {};
  return (sharedState[key] ??= new ValueWrapper<T>(defaultValue)) as ValueWrapper<T>;
}
