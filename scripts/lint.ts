import process from 'node:process';

import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { lint } from '../src/script-utils/linters/eslint.ts';
import { syncAstroTypesIfMissing } from './helpers/sync-astro-types.ts';

const [, , ...paths] = process.argv;
const DEFAULT_PATHS = [
  '.',
  'docs/**/*.astro'
];

await wrapCliTask(async () => {
  await syncAstroTypesIfMissing();
  await lint({ paths: paths.length === 0 ? DEFAULT_PATHS : paths });
});
