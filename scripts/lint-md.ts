import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { lint } from '../src/script-utils/linters/markdownlint.ts';

await wrapCliTask(async () => {
  await lint();
});
