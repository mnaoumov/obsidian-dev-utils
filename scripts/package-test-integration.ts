/**
 * @file
 *
 * Runs ONE workspace package's integration tests; its `test:integration` script points here, naming the vitest
 * projects that hold them (`integration-tests`, and `obsidian-integration-tests` where the package has an Obsidian
 * suite). Each name also selects its `<name>:*` siblings.
 */

import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { test } from '@mnaoumov/typescript-dev-toolkit/test-runners/vitest';
import process from 'node:process';

const [, , ...projects] = process.argv;

await wrapCliTask(async () => {
  if (projects.length === 0) {
    throw new Error('Name the vitest projects holding the integration tests.');
  }
  await test({ projects });
});
