/**
 * @file
 *
 * Vitest setup file for `obsidian-dev-utils`.
 *
 * Add it to your Vitest config's `setupFiles` (or import it from another setup file). Before each
 * test it resets the shared-state bag and enables async-operation tracking; after each test it
 * disables tracking, so tests can `await waitForAllAsyncOperations()` against isolated state.
 */

/* v8 ignore start -- Thin Vitest setup-file glue; setup is unit-tested separately. */
import {
  afterEach,
  beforeEach
} from 'vitest';

import { setup } from './setup.ts';

setup({
  afterEach,
  beforeEach
});
/* v8 ignore stop */
