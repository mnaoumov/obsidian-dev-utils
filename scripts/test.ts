/**
 * @packageDocumentation
 *
 * Test script.
 */

import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { test } from '../src/ScriptUtils/commands/Test.ts';

await wrapCliTask(async () => {
  await test();
});
