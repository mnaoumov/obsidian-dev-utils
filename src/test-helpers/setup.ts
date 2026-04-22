/**
 * @file
 *
 * Vitest setup file for obsidian-dev-utils tests.
 * Initializes `obsidianDevUtilsState` on the global app so that
 * `getObsidianDevUtilsState()` can access it through the strict proxy.
 */

import { castTo } from '../object-utils.ts';
import { setupObsidianTypingsMocks } from './mocks/obsidian-typings/setup.ts';

function setup(): void {
  setupObsidianTypingsMocks();
  setupObsidianDevUtilsState();
}

function setupObsidianDevUtilsState(): void {
  // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
  const record = castTo<Record<string, unknown>>(globalThis);
  const app = castTo<Record<string, unknown> | undefined>(record['app']);
  if (app && !('obsidianDevUtilsState' in app)) {
    app['obsidianDevUtilsState'] = {};
  }
}

setup();
