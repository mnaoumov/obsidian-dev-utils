/**
 * @packageDocumentation
 *
 * Test coverage script.
 */

import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { testCoverage } from '../src/ScriptUtils/Commands.ts';

await wrapCliTask(async () => {
  await testCoverage();
});
