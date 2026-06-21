/**
 * @file
 *
 * Vitest setup file that enables async-operation tracking for the duration of each test.
 *
 * Add it to your Vitest config's `setupFiles` (or import it from another setup file). It enables
 * tracking before each test and disables it afterwards, so tests can `await waitForAllAsyncOperations()`.
 */

/* v8 ignore start -- Thin Vitest setup-file glue; setupAsyncOperationTracking is unit-tested separately. */
import {
  afterEach,
  beforeEach
} from 'vitest';

import { setupAsyncOperationTracking } from './async-operation-tracking-setup.ts';

setupAsyncOperationTracking({
  afterEach,
  beforeEach
});
/* v8 ignore stop */
