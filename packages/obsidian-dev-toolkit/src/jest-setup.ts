/**
 * @file
 *
 * Jest setup file for Obsidian plugins built on `@mnaoumov/obsidian-lib`.
 *
 * Add it to your Jest config's `setupFilesAfterEach` (or import it from another setup file). Before
 * each test it resets the generic shared-state slot, the `__obsidianDevUtils` bag and the library contexts, and enables async-operation tracking; after each test it
 * disables tracking, so tests can `await waitForAllAsyncOperations()` against isolated state.
 *
 * This is a per-test setup file, not a Jest `globalSetup` module, so it has no default export.
 */

/* v8 ignore start -- Thin Jest setup-file glue; setup is unit-tested separately. */
import {
  afterAll,
  afterEach,
  beforeEach
} from '@jest/globals';

import { setup } from './setup.ts';

setup({
  afterAll,
  afterEach,
  beforeEach
});
/* v8 ignore stop */
