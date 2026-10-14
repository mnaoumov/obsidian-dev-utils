/**
 * @file
 *
 * Vitest setup file for Obsidian plugins built on `@mnaoumov/obsidian-lib`.
 *
 * Add it to your Vitest config's `setupFiles` (or import it from another setup file). Before each
 * test it resets the generic shared-state slot, the `__obsidianDevUtils` bag and the library contexts, and enables async-operation tracking; after each test it
 * disables tracking, so tests can `await waitForAllAsyncOperations()` against isolated state.
 */

/* v8 ignore start -- Thin Vitest setup-file glue; setup is unit-tested separately. */
import {
  afterAll,
  afterEach,
  beforeEach
} from 'vitest';

import { setup } from './setup.ts';

setup({
  afterAll,
  afterEach,
  beforeEach
});
/* v8 ignore stop */
