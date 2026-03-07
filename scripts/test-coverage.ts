/**
 * @packageDocumentation
 *
 * Test coverage script.
 */

import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { testCoverage } from '../src/ScriptUtils/commands/TestCoverage.ts';

await wrapCliTask(async () => {
  await testCoverage();
});
