import process from 'node:process';

import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { lint } from '../src/script-utils/linters/markdownlint.ts';

const [, , ...paths] = process.argv;

await wrapCliTask(async () => {
  await lint({ paths });
});
