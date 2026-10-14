import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { lint } from '@mnaoumov/typescript-dev-toolkit/linters/eslint';
import process from 'node:process';

import { syncAstroTypesIfMissing } from './helpers/sync-astro-types.ts';

const [, , ...paths] = process.argv;

await wrapCliTask(async () => {
  await syncAstroTypesIfMissing();
  await lint({ paths, shouldFix: true });
});
