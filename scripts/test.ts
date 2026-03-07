/**
 * @packageDocumentation
 *
 * Test script.
 */

import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { test } from '../src/ScriptUtils/Commands.ts';

await wrapCliTask(async () => {
  await test();
});
