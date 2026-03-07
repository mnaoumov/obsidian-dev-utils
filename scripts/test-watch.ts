/**
 * @packageDocumentation
 *
 * Test watch script.
 */

import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { testWatch } from '../src/ScriptUtils/Commands.ts';

await wrapCliTask(async () => {
  await testWatch();
});
