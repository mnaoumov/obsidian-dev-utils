import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { test } from '../src/script-utils/test-runners/vitest.ts';

await wrapCliTask(async () => {
  await test();
});
