/**
 * @file
 *
 * Builds the whole repository: every workspace package in dependency order, then a type check of the root's own
 * scripts and configuration files.
 */

import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { npmRun } from '@mnaoumov/typescript-dev-toolkit/npm-run';

import { runInWorkspaces } from './helpers/workspaces.ts';

await wrapCliTask(async () => {
  await runInWorkspaces('build');
  await npmRun('build:compile');
});
