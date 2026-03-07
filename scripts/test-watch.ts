/**
 * @packageDocumentation
 *
 * Test watch script.
 */

import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { testWatch } from '../src/ScriptUtils/commands/TestWatch.ts';

await wrapCliTask(async () => {
  await testWatch();
});
