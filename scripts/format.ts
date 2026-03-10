import process from 'node:process';

import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { format } from '../src/script-utils/formatters/dprint.ts';

const [, , ...paths] = process.argv;

await wrapCliTask(async () => {
  await format({ paths });
});
