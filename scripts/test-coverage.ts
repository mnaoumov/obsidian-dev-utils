import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { testCoverage } from '../src/script-utils/test-runners/vitest.ts';

await wrapCliTask(async () => {
  const FULL_COVERAGE_IN_PERCENTS = 100;
  await testCoverage({ minCoverageInPercents: FULL_COVERAGE_IN_PERCENTS });
});
