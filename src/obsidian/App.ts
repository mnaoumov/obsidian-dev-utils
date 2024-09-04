/**
 * @packageDocumentation App
 * Provides a utility to retrieve the Obsidian `App` instance.
 */

import type { App } from 'obsidian';

/**
 * Wrapper type for accessing the `App` instance globally.
 */
interface AppWrapper {
  /**
   * An optional reference to the Obsidian `App` instance.
   */
  app?: App;
}

/**
 * Retrieves the Obsidian `App` instance.
 *
 * @returns The `App` instance.
 * @throws Will throw an error if the `App` instance cannot be found.
 *
 * @see {@link https://github.com/mnaoumov/obsidian-fix-require-modules/?tab=readme-ov-file#obsidianapp-module}
 */
export function getApp(): App {
  let canRequire: boolean;
  try {
    globalThis.require.resolve('obsidian/app');
    canRequire = true;
  } catch {
    canRequire = false;
  }

  if (canRequire) {
    return globalThis.require('obsidian/app') as App;
  }

  const app = (globalThis as AppWrapper).app;
  if (app) {
    return app;
  }

  throw new Error('Obsidian app not found');
}
