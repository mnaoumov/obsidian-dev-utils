import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { format } from '../src/script-utils/formatters/dprint.ts';

await wrapCliTask(async () => {
  await format(false);
});
