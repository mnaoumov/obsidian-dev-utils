/**
 * @file
 *
 * Runs every unit test in the repository with each workspace package held to its own 100% coverage gate. The
 * root's own tests (the build scripts and the docs site) run first, with no coverage threshold, as they always have.
 */

import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { test } from '@mnaoumov/typescript-dev-toolkit/test-runners/vitest';

import { runInWorkspaces } from './helpers/workspaces.ts';

await wrapCliTask(async () => {
  await test({
    projects: ['unit-tests']
  });
  await runInWorkspaces('test:coverage');
});
