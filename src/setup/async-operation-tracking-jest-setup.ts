/**
 * @file
 *
 * Jest setup file that enables async-operation tracking for the duration of each test.
 *
 * Add it to your Jest config's `setupFilesAfterEach` (or import it from another setup file). It enables
 * tracking before each test and disables it afterwards, so tests can `await waitForAllAsyncOperations()`.
 *
 * This is a per-test setup file, not a Jest `globalSetup` module, so it has no default export.
 */

/* v8 ignore start -- Thin Jest setup-file glue; setupAsyncOperationTracking is unit-tested separately. */
import {
  afterEach,
  beforeEach
} from '@jest/globals';

import { setupAsyncOperationTracking } from './async-operation-tracking-setup.ts';

setupAsyncOperationTracking({
  afterEach,
  beforeEach
});
/* v8 ignore stop */
