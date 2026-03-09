import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { spellcheck } from '../src/script-utils/linters/cspell.ts';

await wrapCliTask(async () => {
  await spellcheck();
});
