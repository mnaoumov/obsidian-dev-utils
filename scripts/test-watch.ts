import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { testWatch } from '../src/script-utils/test-runners/vitest.ts';

await wrapCliTask(async () => {
  await testWatch({
    projects: ['unit-tests:*']
  });
});
