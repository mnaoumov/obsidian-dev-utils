import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { testIntegration } from '../src/script-utils/test-runners/vitest.ts';

await wrapCliTask(async () => {
  await testIntegration();
});
