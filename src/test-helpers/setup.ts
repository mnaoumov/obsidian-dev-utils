/**
 * @file
 *
 * Vitest setup file for obsidian-dev-utils tests.
 * Resets the shared-state bag on `globalThis.__obsidianDevUtils` so each test file starts clean.
 */

import { castTo } from '../object-utils.ts';

function setup(): void {
  // eslint-disable-next-line obsidianmd/no-global-this -- The shared state intentionally lives on the realm global.
  castTo<Record<string, unknown>>(globalThis)['__obsidianDevUtils'] = {};
}

setup();
