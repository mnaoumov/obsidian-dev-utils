import process from 'node:process';

import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { spellcheck } from '../src/script-utils/linters/cspell.ts';

const [, , ...paths] = process.argv;

await wrapCliTask(async () => {
  await spellcheck({ paths });
});
