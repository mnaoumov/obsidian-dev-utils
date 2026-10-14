/**
 * @file
 *
 * Runs ONE workspace package's unit tests in watch mode; its `test:watch` script points here.
 */

import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { testWatch } from '@mnaoumov/typescript-dev-toolkit/test-runners/vitest';

await wrapCliTask(async () => {
  await testWatch({
    projects: ['unit-tests']
  });
});
