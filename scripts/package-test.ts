/**
 * @file
 *
 * Runs ONE workspace package's unit tests; its `test` script points here.
 */

import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { test } from '@mnaoumov/typescript-dev-toolkit/test-runners/vitest';

await wrapCliTask(async () => {
  await test({
    projects: ['unit-tests']
  });
});
