/**
 * @file
 *
 * Provides a utility to retrieve the Obsidian `App` instance.
 */

import type { App } from 'obsidian';

interface AppWrapper {
  app: App;
}

/**
 * Retrieves the Obsidian `App` instance.
 *
 * @returns The `App` instance.
 * @throws Will throw an error if the `App` instance cannot be found.
 *
 * @see {@link https://github.com/mnaoumov/obsidian-codescript-toolkit/blob/main/docs/obsidian-app-module.md}
 * @deprecated Usage of this function is not recommended. Pass the {@link App} instance to the function instead when possible.
 */
export function getApp(): App {
  // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
  const app = (globalThis as Partial<AppWrapper>).app;

  if (app) {
    return app;
  }

  try {
    // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
    return globalThis.require('obsidian/app') as App;
  } catch {
    throw new Error('Obsidian App global instance not found');
  }
}
