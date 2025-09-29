/**
 * @packageDocumentation
 *
 * Provides a utility to retrieve the Obsidian `App` instance.
 */

import type { App } from 'obsidian';

import type { GenericObject } from '../ObjectUtils.ts';

import { noop } from '../Function.ts';

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
  obsidianDevUtilsState: GenericObject;
}

/**
 * Wrapper type for storing shared state in the Obsidian app.
 */
export class ValueWrapper<T> {
  /**
   * Creates a new value wrapper.
   *
   * @param value - The value to wrap.
   */
  public constructor(public value: T) {
    noop();
  }
}

/**
 * Retrieves the Obsidian `App` instance.
 *
 * @returns The `App` instance.
 * @throws Will throw an error if the `App` instance cannot be found.
 *
 * @see {@link https://github.com/mnaoumov/obsidian-codescript-toolkit?tab=readme-ov-file#obsidianapp-module}
 * @deprecated Usage of this function is not recommended. Pass the {@link App} instance to the function instead when possible.
 */
export function getApp(): App {
  const app = (globalThis as Partial<AppWrapper>).app;

  if (app) {
    return app;
  }

  try {
    return globalThis.require('obsidian/app') as App;
  } catch {
    throw new Error('Obsidian App global instance not found');
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
export function getObsidianDevUtilsState<T>(app: App | null, key: string, defaultValue: T): ValueWrapper<T> {
  const holder = app ?? getAppOrNull() ?? globalThis;
  const sharedStateWrapper = holder as Partial<ObsidianDevUtilsStateWrapper>;
  sharedStateWrapper.obsidianDevUtilsState ??= {};
  return (sharedStateWrapper.obsidianDevUtilsState[key] ??= new ValueWrapper<T>(defaultValue)) as ValueWrapper<T>;
}

function getAppOrNull(): App | null {
  if (typeof window === 'undefined') {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-deprecated -- We need to use the deprecated function to get the app instance.
  return getApp();
}
