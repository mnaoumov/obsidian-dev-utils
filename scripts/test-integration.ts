/**
 * @file
 *
 * Runs every integration test in the repository, package by package.
 */

import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';

import { runInWorkspaces } from './helpers/workspaces.ts';

await wrapCliTask(async () => {
  await runInWorkspaces('test:integration');
});
