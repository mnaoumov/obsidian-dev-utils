/**
 * @file
 *
 * Runs every unit test in the repository: the root's own (the build scripts and the docs site), then each
 * workspace package's.
 */

import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { test } from '@mnaoumov/typescript-dev-toolkit/test-runners/vitest';

import { runInWorkspaces } from './helpers/workspaces.ts';

await wrapCliTask(async () => {
  await test({
    projects: ['unit-tests']
  });
  await runInWorkspaces('test');
});
