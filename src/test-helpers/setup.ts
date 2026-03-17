/**
 * @packageDocumentation
 *
 * Vitest setup file for obsidian-dev-utils tests.
 * Initializes `obsidianDevUtilsState` on the global app so that
 * `getObsidianDevUtilsState()` can access it through the strict proxy.
 */

import type { GenericObject } from '../type-guards.ts';

const app = (globalThis as Partial<{ app: GenericObject }>).app;

if (app && !('obsidianDevUtilsState' in app)) {
  app.obsidianDevUtilsState = {};
}
